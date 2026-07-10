---
title: Field notebook layout check
description: A private draft used to verify article typography, code blocks, tables, and navigation before real writing is published.
publishDate: 2026-07-11
tags:
  - systems
  - tooling
featured: false
draft: true
---

This private draft exercises the long-form article layout. Replace or remove it
when the first real article is ready.

## A technical section

Long-form writing should remain comfortable when it mixes explanation with
implementation detail. Inline code such as `cargo build --release` should be
distinct without breaking the rhythm of a paragraph.

```rust title="main.rs"
fn main() {
    println!("close to the machine");
}
```

## A small comparison

| Layer | Concern |
| --- | --- |
| Hardware | Throughput and memory movement |
| Runtime | Scheduling and resource ownership |
| Tooling | Repeatable observation |

## A final section

The table of contents appears only when an article has enough structure to make
it useful. This draft is excluded from production builds.
