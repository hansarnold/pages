---
title: "Where RM Runs: Host RM, GSP-RM, and Firmware Boot"
description: A boundary-oriented view of how NVIDIA moves physical resource management onto GSP, bootstraps the firmware, and reconnects it to host RM over RPC.
publishDate: 2026-07-12
tags:
  - gpu
  - linux
  - firmware
draft: false
---

GSP mode is sometimes described as “the driver loads a firmware blob.” That
description misses the architectural change. The important transition is that
Resource Manager is no longer one CPU-resident control plane. Part of RM remains
inside `nvidia.ko`; the physical-device side runs on the GPU System Processor,
and the two halves cooperate over an RPC transport.

NVIDIA engineers use several names for these halves. **Kernel RM**, **CPU-RM**,
or **client RM** refers to the host-resident side. **GSP-RM** or **Physical RM**
refers to RM code executing on GSP. “Physical RM” is the less ambiguous term:
GSP-RM can otherwise mean either the firmware component or the whole split-RM
architecture.

## The split is a control-plane boundary

GSP is an embedded processor with low-latency access to GPU internals. Moving
physical initialization and management there reduces round trips through the
host CPU and gives firmware direct control over hardware-facing operations.
It does not eliminate host RM.

```text
userspace: CUDA driver, NVML, graphics stack
                 │
                 │ ioctl / mmap / RMAPI
                 ▼
┌──────────────────────────────────────────────────────┐
│ Kernel RM / CPU-RM in nvidia.ko                      │
│                                                      │
│ Linux PCI + DMA integration     client/object state │
│ OS memory and event plumbing    ioctl/RMAPI boundary│
│ diagnostics and policy          GSP RPC client      │
└───────────────────────┬──────────────────────────────┘
                        │ command queues / status queues
                        │ sequenced RPC + async events
                        ▼
┌──────────────────────────────────────────────────────┐
│ Physical RM / GSP-RM firmware                        │
│                                                      │
│ physical GPU initialization     engine management   │
│ hardware-facing RM operations   recovery work       │
│ latency-sensitive control       firmware services   │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
             GPU engines, memory, interrupts
```

The split can be seen in the open kernel source. CPU-RM sends operations such
as `GSP_RM_ALLOC`, `GSP_RM_CONTROL`, and `FREE`; GSP sends events in the other
direction. The host handles the OS-visible consequences: delivering client
notifications, recording diagnostics, turning GSP-reported failures into Xids,
and performing the host portion of recovery.

This is not simply remote procedure call as a code-organization trick. It is a
failure and ownership boundary. A host thread can be alive while Physical RM is
not ready. GSP can report an engine failure after module initialization. An RPC
can be queued successfully and still time out waiting for firmware progress.

## Firmware boot constructs the RPC peer

The exact secure-boot path changes across Turing, Ampere, Hopper, Blackwell, and
later chips. A single universal sequence involving Booter, FWSEC, or FSP would
be misleading. At the level visible to host RM, however, the phases are stable.

### 1. Linux binds the PCI function

`nvidia.ko` first exists as a normal Linux PCI driver. Probe establishes the OS
resources needed to reach the device: BAR mappings, DMA capabilities,
interrupts, power state, and the per-device host data structures. GSP bootstrap
cannot be treated independently of this layer; firmware loading needs a working
path from host memory to the GPU.

### 2. Host RM selects and requests the firmware

The module declares architecture-specific firmware such as `gsp_tu10x.bin` and
`gsp_ga10x.bin`. Linux's firmware loader resolves the file belonging to the
installed driver release. Host RM parses the firmware container, checks the
versioned sections it expects, and prepares a boot image for the target GPU.

Version cohesion matters here. NVIDIA requires the open kernel modules, GSP
firmware, and userspace driver components to come from the corresponding driver
release. A file being present under `/lib/firmware` establishes neither that it
is the selected file nor that its interface matches host RM.

### 3. Host RM builds the shared bootstrap state

Before GSP-RM can answer an RPC, both sides need memory and protocol state. Host
RM prepares firmware metadata and boot arguments, protected firmware regions,
shared command/status queues, RPC message buffers, log and crash-reporting
surfaces, and other generation-specific bootstrap data.

This stage is why an IOMMU or DMA problem can look like a firmware failure. GSP
must be able to access the system-memory surfaces that host RM populated. The
host-side RPC sanity checks explicitly reject operation when the GPU has lost
system-memory access or is not in the required power state.

### 4. The hardware-specific chain starts GSP

On Turing and Ampere-era paths, driver traces expose steps such as protected
region setup, Booter/FWSEC work, loading GSP microcode, and starting the GSP
RISC-V core. Newer architectures can place FSP in front of parts of this chain.
These components establish authenticity and protected execution before
Physical RM is allowed to run.

The portable invariant is not a particular microcontroller name. It is:

```text
host-prepared image
    → architecture-specific authenticated bootstrap
    → GSP execution begins
    → Physical RM initializes
    → host/GSP queues become live
```

### 5. Host RM waits for Physical RM readiness

Starting the RISC-V core is not the success condition. Host RM waits for the
firmware RM ready state, initializes the status and command queues, constructs
its RPC object, and waits for RM initialization to complete. Only then can the
adapter initialization path proceed as a coherent split driver.

The distinction appears directly in failure logs:

```text
GSP ucode loaded and RISCV started
Waiting for GSP fw RM to be ready...
...
RmInitAdapter: Cannot initialize GSP firmware RM
```

The first line proves instruction execution began on GSP. It does not prove
that Physical RM initialized, that the queue protocol is usable, or that
`RmInitAdapter` completed.

## Runtime is a bidirectional protocol

After bootstrap, CPU-RM is an RPC client but not a passive proxy. A typical
synchronous operation follows this shape:

1. Host RM serializes an RM operation into the shared message buffer.
2. It assigns a sequence number and posts the command queue.
3. GSP-RM performs the physical operation.
4. A status record returns the result for that sequence.
5. Host RM translates the result back into the client-facing RMAPI path.

Events travel in the opposite direction without originating from a userspace
call. GSP-RM can report channel recovery, ECC state, engine errors, performance
samples, or a fatal firmware condition. CPU-RM attaches process and client
context where needed, writes Linux-visible diagnostics, and wakes or notifies
the relevant host objects.

This division also explains why a GSP timeout is not equivalent to a GPU kernel
hang. The Linux CPU can continue scheduling the waiting RM thread; what stopped
making progress is the remote control processor or the transport between the
two RMs. The driver's timeout history records the RPC function, sequence, start
and completion timing, and selected operation-specific data so the failure can
be attributed to that boundary.

GSP-RM should also not be conflated with every firmware-controlled engine on
the GPU. PMU, SEC2, FECS, and other microcontrollers have their own roles and
microcode. Physical RM can initialize, command, or consume events from those
engines, but “runs on firmware” does not mean all GPU firmware is GSP-RM.

## Read failures as boot-stage evidence

| Evidence | What has been proven | Next boundary |
| --- | --- | --- |
| firmware request fails | PCI probe reached firmware loading | package contents and selected firmware path |
| Booter, FWSEC, or FSP reports failure | host prepared enough state to enter secure bootstrap | architecture-specific authentication and protected memory |
| “RISC-V started” followed by ready timeout | GSP executed code | Physical RM startup, queues, or shared-memory visibility |
| `GSP_RM_*` RPC timeout after initialization | boot completed and transport previously worked | firmware progress, GPU power/reset state, or queue transport |
| GSP reports Xid/RC event | firmware detected a physical/engine failure | host recovery and client notification path |
| `nvidia-smi` reports driver/library mismatch | userspace reached a kernel stack | release cohesion above the GSP boundary |

The useful inspection set is therefore broader than `lsmod`:

```sh
# Which firmware objects can this installed module request?
modinfo -F firmware nvidia

# Which host kernel module is actually resident?
cat /proc/driver/nvidia/version
cat /sys/module/nvidia/version

# Did this adapter complete initialization with GSP enabled?
nvidia-smi -q | grep -A2 'GSP Firmware Version'
cat /proc/driver/nvidia/gpus/*/information

# Reconstruct bootstrap and runtime failures in order.
journalctl -k -b | grep -E 'NVRM|GSP|FSP|FWSEC|Xid|RmInitAdapter|firmware'
```

`NVreg_EnableGpuFirmware=0` is useful as an A/B diagnostic only where the
proprietary driver and GPU support running without GSP. It is not a general fix
for open kernel modules: the open flavor depends on GSP, and newer architectures
can require that flavor entirely.

The mental model I want to keep is: **loading `nvidia.ko` creates the host half
of the driver. A usable GSP-mode GPU exists only after an authenticated,
generation-specific boot chain creates Physical RM, shared queues establish a
working RPC peer, and `RmInitAdapter` reconciles the two halves.**

## Sources

- [NVIDIA README: GSP Firmware](https://download.nvidia.com/XFree86/Linux-x86_64/580.95.05/README/gsp.html)
- [NVIDIA open GPU kernel modules](https://github.com/NVIDIA/open-gpu-kernel-modules)
- [NVIDIA `kernel_gsp.c`: RPC and event boundary](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/src/nvidia/src/kernel/gpu/gsp/kernel_gsp.c)
- [NVIDIA `nv.c`: Linux module and PCI initialization](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia/nv.c)
- [NVIDIA codebase discussion: Kernel RM and Physical RM terminology](https://github.com/NVIDIA/open-gpu-kernel-modules/discussions/157)
