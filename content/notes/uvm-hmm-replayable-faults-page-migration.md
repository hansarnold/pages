---
title: "From GPU Fault to Replay: UVM, HMM, and Page Migration"
description: Tracing a replayable GPU fault through UVM batching, residency policy, Linux HMM invalidation, migrate_vma, GPU page-table updates, and replay.
publishDate: 2026-07-12
tags:
  - gpu
  - cuda
  - linux
draft: false
---

A unified virtual address does not imply unified physical residence. On a
software-coherent CPU/GPU system, a pointer can remain stable while ownership,
residency, and page-table mappings move between processors. NVIDIA UVM is the
kernel subsystem that turns a GPU MMU fault into those state transitions.

The interesting path begins after an SM issues an access that its GPU page
tables cannot currently satisfy. “Replayable” means the hardware can suspend
the affected work, let software repair translation or permissions, and replay
the access. It does not mean the driver handles one fault at a time, nor that
every repair requires migration.

## Three VM layers meet in `nvidia-uvm`

It helps to separate three pieces that are often all called Unified Memory.

1. **UVM-managed address space** tracks CUDA-managed allocations, per-process
   GPU VA spaces, residency, mappings, access policy, and in-flight operations.
2. **GPU replayable-fault machinery** transfers hardware fault records to UVM
   and restarts work after UVM services a batch.
3. **Linux HMM** lets UVM mirror an ordinary process VMA and participate in
   Linux page migration when the memory was allocated by `malloc`, `mmap`, or
   another system allocator rather than by a CUDA managed-allocation API.

CUDA exposes a common programming model over these paths. The kernel mechanics
are different.

| Boundary | CUDA-managed memory | HMM-backed pageable memory |
| --- | --- | --- |
| allocation owner | UVM/CUDA knows the VA range at creation | Linux VMA and CPU page tables are authoritative |
| range metadata | persistent UVM VA range and VA blocks | HMM VA blocks created around valid VMAs |
| CPU mapping changes | coordinated through UVM's managed mapping | observed through MMU interval notifiers |
| page snapshot | UVM residency and mapping masks | `hmm_range_fault()` walks/faults CPU PTEs |
| migration transaction | UVM block copy/map operations | Linux `migrate_vma_*()` plus UVM copy/map work |

Both paths eventually feed UVM's VA-block service code, but HMM must continuously
reconcile driver state with an address space Linux can change independently.

## A replayable fault is first a hardware record

A GPU fault-buffer entry carries more context than a virtual address. UVM
decodes the GPU instance pointer that identifies a GPU VA space, subcontext or
VEID, faulting engine/client and uTLB, access type, and fault address. The access
type matters because the repair for a prefetch, read, write, or atomic access
does not have the same permission and coherence requirements.

The UVM source orders access types by “intrusiveness”:

```text
atomic strong > atomic weak > write > read > prefetch
```

If several records refer to the same VA, servicing only a read while a write or
atomic is pending would create another immediate fault. UVM therefore retains
the strongest access requirement when it coalesces duplicates.

## Interrupt handling deliberately leaves hard-IRQ context

The top half does not migrate memory. It disables or accounts for the
replayable-fault interrupt and schedules a bottom half. Fault service may need
locks, page allocation, DMA copies, GPU pushes, Linux MM interaction, and waits
on prior work—none of which belongs in hard-IRQ context.

During fault-buffer initialization, UVM asks RM for the buffer layout and takes
ownership of the page-fault interrupt. It maintains cached GET and PUT pointers
for the circular buffer. Reading the hardware PUT pointer over BAR0/PCIe is
expensive, so the service path tries to amortize that access.

The bottom half processes bounded batches rather than draining forever. This
prevents a fault storm from monopolizing a CPU worker and lets interrupt service
be rescheduled when more entries remain.

## Fetch, identify, sort, and coalesce

The first half of service is about turning unordered hardware observations into
work UVM can lock efficiently:

```text
GPU fault buffer
    → read valid entries between cached GET/PUT
    → decode instance pointer, VA, access, uTLB and client
    → resolve instance pointer to GPU VA space
    → sort/group by VA space and virtual address
    → merge duplicate faults, preserving strongest access
    → build per-VA-block service masks
```

Duplicate faults are normal. Multiple warps, CTAs, or uTLBs can touch the same
unmapped page before the first fault is serviced. Replaying a partially drained
buffer can also cause records that were not yet consumed to appear again. UVM
tracks duplicates and chooses when to refresh PUT or flush the buffer based on
that behavior.

The instance pointer is critical. The same numeric VA in two processes is not
the same fault. UVM must associate the record with the registered GPU page
tables and then with the owning `uvm_va_space`. A stale channel or unknown VA
space is a cancellation/error path, not a migration request.

## Servicing chooses residency and permissions

For a valid VA range, UVM computes a service region and a destination processor.
That decision is policy, not a fixed “faulting GPU wins” rule. Inputs can include:

- current CPU and GPU residency;
- preferred-location and accessed-by advice;
- peer accessibility between GPUs;
- read duplication eligibility;
- whether the request is read, write, or atomic;
- detected CPU/GPU thrashing;
- memory pressure and eviction state;
- whether remote mapping is cheaper or required.

A read may be satisfied by mapping remote system memory, establishing a peer
mapping, migrating the page, or creating a read-duplicated copy. A write usually
requires invalidating or downgrading competing mappings before granting write
access. An atomic can require exclusive access when the platform cannot provide
the required cross-processor atomic coherence.

This is why counting GPU page faults alone is not enough to infer bytes migrated.
A fault is a request for a valid translation and access permission. Migration is
one possible repair.

## HMM makes Linux page tables authoritative

For ordinary pageable memory, UVM did not create the allocation and cannot
assume its cached view is current. Linux can unmap a VMA, change permissions,
fork, reclaim or swap a page, replace a PTE, or migrate a page for another
reason. HMM provides two key protocols to make a device MMU coexist with that
activity.

### MMU interval notifiers protect the mirror

UVM registers an `mmu_interval_notifier` over each HMM VA block. When Linux is
about to invalidate a CPU page-table range, the callback updates or removes the
corresponding GPU mappings before the CPU-side change is allowed to complete.

Fault service uses a sequence protocol:

1. Record the notifier sequence.
2. Drop locks that the invalidation callback may need.
3. Call `mmu_interval_read_begin()` and `hmm_range_fault()`.
4. Reacquire the UVM VA-block lock.
5. Retry if an invalidation changed the sequence.

That retry is not exceptional. It is the correctness mechanism for a race
between GPU fault service and CPU page-table mutation.

`hmm_range_fault()` returns a stable snapshot of PFNs and permissions for the
requested range. With fault flags, it can ask Linux to populate missing CPU
pages. UVM then converts that snapshot into its CPU-residency and mapping masks.
Not every VMA is eligible: the current UVM HMM path rejects or specially handles
cases such as `userfaultfd`, `VM_IO`, and `VM_PFNMAP` because their fault and PFN
semantics do not fit the normal mirror.

### `migrate_vma` is a transaction, not a memcpy

When HMM-backed system pages should become device-private GPU pages, Linux and
UVM divide the migration:

```text
migrate_vma_setup()
    invalidate other device MMUs
    lock/isolate source pages
    replace CPU PTEs with migration entries
            ↓
UVM allocates GPU device-private pages/chunks
UVM copies source data and prepares GPU mappings
            ↓
migrate_vma_pages()
    commit Linux page ownership/state
            ↓
UVM installs or rolls back GPU MMU mappings
            ↓
migrate_vma_finalize()
    replace migration entries and release old pages
```

Device-private memory still has Linux `struct page` representations, but those
pages are not CPU-addressable system RAM. A later CPU access encounters a
device-private entry and faults. The driver's device-memory fault callback then
uses the reverse migration path to bring data back to system memory before the
CPU access completes.

Atomic GPU access is stricter. On systems without suitable hardware-coherent
atomics, UVM may use Linux's device-exclusive mechanism so CPU mappings cannot
race the GPU's atomic operation. Exclusivity ends when the driver releases the
locked page and Linux is allowed to satisfy CPU faults again.

## Replay comes after the repair is ordered

UVM tracks asynchronous copies, PTE writes, TLB invalidations, and other GPU
pushes. It must ensure the operations that make the access legal are ordered
before issuing replay. Merely allocating a destination page is not enough.

After a batch is serviced, UVM advances the fault-buffer GET pointer and pushes
a hardware replay method. The GPU reissues the stalled accesses. New faults can
arrive during service, and accesses that were not fully covered can fault again,
so replay and fault-buffer draining form a loop rather than a single request/
response exchange.

Fatal faults take a different exit. If policy or VA state says an access cannot
be repaired, UVM records the fatal reason and issues a targeted or global cancel
instead of endlessly replaying it. Replayability is a hardware recovery
capability, not permission to make every address valid.

## Software and hardware coherence change the backend

On a discrete, software-coherent system, CPU and GPU have logically separate
page tables and coherence is enforced through invalidation, faults, migration,
and remote mappings. Frequent ownership changes can ping-pong whole pages even
when the processors touch different cache lines.

Hardware-coherent systems and ATS-capable paths can let the GPU use CPU page
tables or access system memory with much less software intervention. CUDA may
still report pageable-memory access through one programming model, but the
backend need not execute the same HMM migration path. Capability bits describe
what applications may do; they do not uniquely identify the kernel mechanism.

## Read performance symptoms as VM behavior

| Symptom | Likely mechanism |
| --- | --- |
| first-touch burst followed by stable execution | demand population/migration working as intended |
| repeated CPU↔GPU fault waves on the same range | page thrashing or conflicting placement policy |
| many duplicate faults for one VA | concurrent warps/uTLBs reaching an unresolved page |
| HMM service repeatedly retries | concurrent CPU MMU invalidation; inspect the mutating workload |
| migration stalls under memory pressure | GPU allocation, eviction, or copy dependencies |
| fatal fault/cancel rather than replay | invalid VA, permission, stale channel, or unsupported VMA |

Tools such as Nsight Systems can show Unified Memory GPU page faults and
migration activity. Application-side prefetch and memory advice are useful only
after identifying the access pattern; they change policy and timing, not the
underlying need for correct invalidation and ordering.

The mental model I want to keep is: **a replayable GPU fault is a distributed VM
transaction. UVM identifies the GPU address space, batches and coalesces access
requirements, reconciles residency and permissions, joins Linux's HMM migration
protocol when CPU page tables own the allocation, orders GPU MMU updates, and
only then asks hardware to replay the access.**

## Sources

- [NVIDIA UVM replayable-fault implementation](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia-uvm/uvm_gpu_replayable_faults.c)
- [NVIDIA UVM interrupt handling](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia-uvm/uvm_gpu_isr.c)
- [NVIDIA UVM HMM integration](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia-uvm/uvm_hmm.c)
- [NVIDIA pageable-memory migration](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia-uvm/uvm_migrate_pageable.c)
- [Linux Heterogeneous Memory Management](https://docs.kernel.org/mm/hmm.html)
- [CUDA Programming Guide: Unified Memory](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/unified-memory.html)
