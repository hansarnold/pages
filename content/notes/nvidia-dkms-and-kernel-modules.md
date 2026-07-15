---
title: Where DKMS Ends in the NVIDIA Linux Driver
description: Following an NVIDIA driver build across RM, Kbuild, module ABI checks, GSP firmware, UVM, and DRM to see what DKMS does—and what it cannot do.
publishDate: 2026-07-12
updatedDate: 2026-07-15
tags:
  - gpu
  - linux
  - kernel
draft: false
---

The interesting question about NVIDIA's DKMS packages is not what a `.ko` file
is. It is **which part of the driver is rebuilt for a new kernel, which
contracts are checked before load, and how far a successful DKMS install is
from a working GPU**.

The short answer: DKMS owns the build-and-install lifecycle of the host kernel
objects. It does not validate the complete driver stack. Between source and a
working CUDA or display context sit several independent boundaries: Kbuild API
adaptation, exported kernel symbols, module signing, PCI probe, RM and GSP
initialization, inter-module symbols, device nodes, and an exactly matched
userspace stack.

<figure class="system-diagram scope-diagram" aria-labelledby="dkms-scope-title">
  <figcaption id="dkms-scope-title">
    <strong>DKMS covers one segment of the path to a working GPU</strong>
    <span>A successful install leaves several independent gates unchecked.</span>
  </figcaption>
  <div class="scope-track">
    <div class="scope-group scope-owned">
      <span class="scope-owner">DKMS owns</span>
      <div class="scope-step">
        <span class="diagram-kicker">01</span>
        <strong>Add</strong>
        <small>register source</small>
      </div>
      <span class="diagram-arrow" aria-hidden="true">→</span>
      <div class="scope-step">
        <span class="diagram-kicker">02</span>
        <strong>Build</strong>
        <small>conftest · Kbuild · MODPOST</small>
      </div>
      <span class="diagram-arrow" aria-hidden="true">→</span>
      <div class="scope-step">
        <span class="diagram-kicker">03</span>
        <strong>Install</strong>
        <small>module tree · depmod</small>
      </div>
    </div>
    <span class="diagram-arrow scope-boundary" aria-hidden="true">→</span>
    <div class="scope-group scope-external">
      <span class="scope-owner">Outside DKMS</span>
      <div class="scope-step">
        <span class="diagram-kicker">04</span>
        <strong>Load</strong>
        <small>ABI · symbols · signature</small>
      </div>
      <span class="diagram-arrow" aria-hidden="true">→</span>
      <div class="scope-step">
        <span class="diagram-kicker">05</span>
        <strong>Initialize</strong>
        <small>PCI · RM · GSP · device nodes</small>
      </div>
      <span class="diagram-arrow" aria-hidden="true">→</span>
      <div class="scope-step">
        <span class="diagram-kicker">06</span>
        <strong>Use</strong>
        <small>matching userspace stack</small>
      </div>
    </div>
  </div>
</figure>

## What NVIDIA actually rebuilds

NVIDIA's source tree separates OS-agnostic driver code from the Linux kernel
interface layer. In the packaged proprietary driver, the large cores for
`nvidia.ko` and `nvidia-modeset.ko` arrive as `nv-kernel.o_binary` and
`nv-modeset-kernel.o_binary`; Kbuild links them with objects compiled against
the target Linux kernel. The open-module repository publishes the corresponding
source, but preserves the same architectural boundary. `nvidia-drm.ko` and
`nvidia-uvm.ko` are Linux-facing implementations and do not have those
OS-agnostic binary components.

<figure class="system-diagram module-build-diagram" aria-labelledby="module-build-title">
  <figcaption id="module-build-title">
    <strong>What Kbuild combines for each NVIDIA kernel module</strong>
    <span>Every row is built for the target kernel, but not every input is source code in the proprietary package.</span>
  </figcaption>
  <div class="module-build-head" aria-hidden="true">
    <span>Driver-side input</span><span>Kernel-facing input</span><span>Output</span>
  </div>
  <div class="module-build-row">
    <div><strong>RM core</strong><small><code>nv-kernel.o_binary</code> or open source</small></div>
    <span class="diagram-plus" aria-hidden="true">+</span>
    <div><strong>Linux interface</strong><small>compiled for the target kernel</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia.ko</code><small>resource manager</small></div>
  </div>
  <div class="module-build-row">
    <div><strong>NVKMS core</strong><small><code>nv-modeset-kernel.o_binary</code> or open source</small></div>
    <span class="diagram-plus" aria-hidden="true">+</span>
    <div><strong>Linux interface</strong><small>compiled for the target kernel</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia-modeset.ko</code><small>display engine control</small></div>
  </div>
  <div class="module-build-row module-build-native">
    <div><strong>Linux DRM/KMS glue</strong><small>kernel-facing implementation</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia-drm.ko</code><small>DRM bridge</small></div>
  </div>
  <div class="module-build-row module-build-native">
    <div><strong>Linux UVM/HMM code</strong><small>kernel-facing implementation</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia-uvm.ko</code><small>virtual memory</small></div>
  </div>
  <div class="module-build-row module-build-native">
    <div><strong>RDMA peer-memory glue</strong><small>kernel-facing implementation</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia-peermem.ko</code><small>GPUDirect RDMA</small></div>
  </div>
</figure>

The build is more than compiling against a directory named after `uname -r`.
NVIDIA runs a large set of compile and symbol probes—its `conftest` layer—to
discover kernel API shape and export status. The current Kbuild rules probe
things such as `get_user_pages`, `pin_user_pages`, DMA-BUF interfaces, IOMMU/SVA,
DRM helpers, shrinkers, and changing structure members. Those results select
compatibility paths before Kbuild compiles the Linux interface objects.

Kbuild then performs `MODPOST`. It resolves imported symbols against the
kernel's `Module.symvers`, checks namespaces and GPL-only exports, emits module
metadata, and—when `CONFIG_MODVERSIONS` is enabled—records CRCs for imported
symbol prototypes. That makes the build output specific not only to a release
name, but to the target kernel's exported interface set and configuration.

This explains a common misconception: DKMS does not provide a stable ABI. It
automates rebuilding against an unstable one, while the driver's compatibility
layer absorbs the API churn it knows about.

## The lifecycle DKMS owns

The first three stages in the opening diagram are the useful DKMS state
machine. `add` registers a source/version pair from
`/usr/src/nvidia-<driver-version>/`. `build -k <kernel>/<arch>` produces
artifacts for one kernel and architecture through conftest, Kbuild, and
MODPOST. `install` copies the resulting `*.ko[.xz|.zst]` files into that
kernel's module tree and refreshes the depmod database.

`dkms status` distinguishes these states. **Built** means artifacts exist for a
kernel/architecture pair. **Installed** means DKMS placed them in that kernel's
module tree. `autoinstall` finds modules installed for other kernel revisions
and attempts to install their latest revision for the target kernel. Linux
distributions normally invoke it from kernel-package hooks.

DKMS may also sign modules during the build/install flow. That only proves a
signature was appended. It does not prove the running kernel trusts the
certificate. Under Secure Boot or `module.sig_enforce=1`, trust is a separate
load-time decision.

DKMS does **not** decide which copy wins when the initramfs contains an older
module, bind the PCI function, initialize GSP firmware, create a usable CUDA
context, or ensure that `libcuda`, NVML, firmware, and all kernel modules belong
to one driver release. Package-manager and initramfs hooks are responsible for
some of those tasks; the driver owns the rest.

## The kernel has more than one compatibility gate

An installed object can still fail before its module initializer runs:

- **vermagic** captures the kernel release and selected build properties. An
  obvious mismatch produces `invalid module format`.
- **symbol resolution** requires every imported symbol to exist and be exported
  to this module. Namespaces and GPL-only exports matter.
- **modversions**, when enabled, compare per-symbol CRCs derived from function
  prototypes. Two kernels with similar release strings can still disagree.
- **signature policy** checks whether the appended signature chains to a key
  trusted by the running kernel.
- **architecture hardening and toolchain choices**—for example CFI, retpoline,
  IBT, or compiler-specific kernel options—can impose additional build and load
  constraints.

Forcing away vermagic or modversion checks is therefore not a repair. It removes
evidence that the module was built against a different contract.

## Loading the modules is only the next boundary

At runtime the NVIDIA modules form a dependency graph, not a flat list:

<figure class="system-diagram runtime-diagram" aria-labelledby="runtime-path-title">
  <figcaption id="runtime-path-title">
    <strong>Three runtime paths share RM but fail independently</strong>
    <span>The arrows show the primary control path, not every internal call.</span>
  </figcaption>
  <div class="runtime-lane">
    <span class="runtime-label">Compute</span>
    <div><strong>CUDA / NVML</strong><small>userspace</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div><code>/dev/nvidia*</code><small>ioctl · mmap</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia.ko</code><small>RM · PCI · GPU control</small></div>
    <div class="runtime-branch"><code>/dev/nvidia-uvm</code><span aria-hidden="true">→</span><code>nvidia-uvm.ko</code><span aria-hidden="true">→</span><span>RM interface</span></div>
  </div>
  <div class="runtime-lane">
    <span class="runtime-label">Display</span>
    <div><strong>Xorg / Wayland / GBM</strong><small>userspace</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div><code>/dev/dri/card*</code><small>DRM device</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><code>nvidia-drm.ko</code><small>DRM/KMS registration</small></div>
    <div class="runtime-branch"><span>DRM core</span><span aria-hidden="true">↔</span><code>nvidia-drm.ko</code><span aria-hidden="true">→</span><code>nvidia-modeset.ko</code><span aria-hidden="true">→</span><code>nvidia.ko</code></div>
  </div>
  <div class="runtime-lane">
    <span class="runtime-label">RDMA</span>
    <div><strong>GPUDirect RDMA</strong><small>peer-memory client</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div><code>nvidia-peermem.ko</code><small>peer-memory glue</small></div>
    <span class="diagram-arrow" aria-hidden="true">→</span>
    <div class="diagram-output"><strong>RM + RDMA core</strong><small>shared boundary</small></div>
  </div>
</figure>

The open `nvidia.ko` source shows the boundary directly: it registers the PCI
driver, initializes RM, exposes character-device operations including `ioctl`
and `mmap`, and registers the regular GPU minors plus the control device. A
module can be present in `/proc/modules` while PCI probe or `rm_init_adapter`
has failed, leaving no initialized GPU behind it.

`nvidia-uvm.ko` is not “the CUDA module.” It is the kernel implementation of
GPU virtual-address-space and managed-memory operations. Its ioctl surface
includes GPU and VA-space registration, channel registration, preferred
location and accessed-by policy, migration, peer access, pageable-memory/HMM
operations, and fault-related machinery. It imports the RM-facing
`nvUvmInterface*` contract from `nvidia.ko`; an unknown symbol here often means
a partial driver upgrade or mixed module flavors, not a generic CUDA failure.

`nvidia-drm.ko` is similarly a Linux DRM bridge rather than the core hardware
driver. With modesetting enabled it advertises `DRIVER_MODESET` and
`DRIVER_ATOMIC`, allocates a `drm_device` per GPU reported by NVKMS, and
registers it with the DRM subsystem. This is why `nvidia-smi` can work while a
Wayland session fails: the RM/compute path may be alive while NVKMS or DRM
device registration is not.

The open modules add another processor to the initialization chain: GSP. They
require GSP firmware, and NVIDIA requires the kernel modules, firmware, and
userspace components to come from the matching driver release. Successful
linking and insertion of `nvidia.ko` says nothing about whether GSP-RM booted or
whether RM completed adapter initialization.

## Diagnose the failed boundary, not “the driver”

| Observation | Boundary to investigate |
| --- | --- |
| DKMS stops before producing modules | headers, conftest result, compiler, Kbuild or MODPOST |
| `.ko` exists but `modprobe` reports invalid format | vermagic, modversions, target configuration or architecture |
| `Required key not available` | module signature and kernel/MOK trust chain |
| `nvidia` loads but no GPU is initialized | PCI ownership, supported module flavor, firmware/GSP or RM probe |
| `nvidia_uvm` reports unknown `nvUvmInterface*` symbols | mixed kernel-module releases/flavors or partial installation |
| `nvidia-smi` works but Wayland/KMS fails | `nvidia-modeset` → NVKMS → `nvidia-drm` → DRM registration path |
| loaded version differs from files under `/lib/modules` | stale initramfs or module already resident across an upgrade |
| NVML reports a driver/library mismatch | loaded kernel stack and userspace package versions diverged |

A compact evidence capture for those boundaries is:

```sh
k=$(uname -r)

dkms status -m nvidia
modinfo nvidia | grep -E '^(filename|version|vermagic|license|signer|firmware):'
modinfo -F depends nvidia_drm
modprobe --show-depends nvidia_drm

cat /proc/driver/nvidia/version
cat /sys/module/nvidia/version
grep '^nvidia' /proc/modules
lspci -nnk -d 10de:
ls -l /dev/nvidia* /dev/dri 2>/dev/null

journalctl -k -b | grep -E 'NVRM|nvidia|GSP|Xid|module|firmware'
```

`modinfo` describes the object currently found in the filesystem; `/sys/module`
and `/proc/driver/nvidia/version` describe the loaded stack. Comparing them is
important after an upgrade. If the early boot path includes NVIDIA modules,
inspect the initramfs separately with the distribution's `lsinitramfs` or
`lsinitrd` tool.

The mental model I want to keep is: **DKMS success establishes that a set of
host kernel objects was built and installed for one kernel. It does not establish
that Linux accepted them, that their cross-module ABI is coherent, that RM/GSP
initialized the device, or that userspace is speaking the same driver release.**

## Sources

- [NVIDIA open GPU kernel modules: architecture and build](https://github.com/NVIDIA/open-gpu-kernel-modules)
- [NVIDIA `Kbuild` rules](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/Kbuild)
- [NVIDIA `nvidia.ko` Linux interface](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia/nv.c)
- [NVIDIA UVM implementation](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia-uvm/uvm.c)
- [NVIDIA DRM device registration](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/kernel-open/nvidia-drm/nvidia-drm-drv.c)
- [Linux Kbuild: building external modules](https://docs.kernel.org/kbuild/modules.html)
- [Linux kernel module signing](https://docs.kernel.org/admin-guide/module-signing.html)
- [DKMS manual](https://github.com/dkms-project/dkms/blob/main/dkms.8.in)
