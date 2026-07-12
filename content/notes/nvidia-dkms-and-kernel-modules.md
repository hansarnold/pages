---
title: Where DKMS Ends in the NVIDIA Linux Driver
description: Following an NVIDIA driver build across RM, Kbuild, module ABI checks, GSP firmware, UVM, and DRM to see what DKMS does—and what it cannot do.
publishDate: 2026-07-12
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

## What NVIDIA actually rebuilds

NVIDIA's source tree separates OS-agnostic driver code from the Linux kernel
interface layer. In the packaged proprietary driver, the large cores for
`nvidia.ko` and `nvidia-modeset.ko` arrive as `nv-kernel.o_binary` and
`nv-modeset-kernel.o_binary`; Kbuild links them with objects compiled against
the target Linux kernel. The open-module repository publishes the corresponding
source, but preserves the same architectural boundary. `nvidia-drm.ko` and
`nvidia-uvm.ko` are Linux-facing implementations and do not have those
OS-agnostic binary components.

```text
                   target kernel headers + configuration
                                  │
                                  ▼
RM core ───────────────┐    Linux interface objects ──┐
                       ├───────────────────────────────┴─> nvidia.ko
NVKMS core ────────────┤    Linux interface objects ─────> nvidia-modeset.ko
                       │
Linux DRM/KMS glue ────┴─────────────────────────────────> nvidia-drm.ko
Linux UVM/HMM code ──────────────────────────────────────> nvidia-uvm.ko
RDMA peer-memory glue ───────────────────────────────────> nvidia-peermem.ko
```

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

## The state machine DKMS owns

Ignoring distribution-specific paths, the useful DKMS state machine is:

```text
/usr/src/nvidia-<driver-version>/
          │
          ├─ add ───────> source registered in the DKMS tree
          │
          ├─ build -k <kernel>/<arch>
          │                └─ conftest → Kbuild → MODPOST → *.ko
          │
          └─ install ───> /lib/modules/<kernel>/.../*.ko[.xz|.zst]
                                         └─ depmod database update
```

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

```text
userspace CUDA / NVML
    ├─ ioctl + mmap ─> /dev/nvidiactl, /dev/nvidiaN ─> nvidia.ko (RM)
    └─ ioctl + mmap ─> /dev/nvidia-uvm ──────────────> nvidia-uvm.ko
                                                           │
                                                           └─ RM UVM interface

Xorg / Wayland compositor / GBM
    ├─ /dev/nvidia-modeset ─> nvidia-modeset.ko (NVKMS) ─> nvidia.ko
    └─ /dev/dri/card* ──────> nvidia-drm.ko ─────────────> NVKMS + DRM core

GPUDirect RDMA ─────────────> nvidia-peermem.ko ─────────> RM + RDMA peer memory
```

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
