---
title: "Installation"
description: "Install and run DirtOS and its documentation toolchain."
---

## Requirements

- Linux, macOS, or Windows desktop environment
- Node.js 20+ (project uses `.nvmrc`)
- Rust toolchain (for Tauri backend)
- `pnpm` package manager

## App Setup

1. Clone the repository.
2. Install dependencies.
3. Start the app in development mode.

```bash
pnpm install
pnpm dev
```

> [SCREENSHOT:install-terminal-success]
> Capture a successful first `pnpm dev` run with no blocking errors.

## Documentation Setup (docmd)

DirtOS documentation is maintained with `docmd`.

```bash
pnpm install
pnpm docs:dev
```

Build static docs:

```bash
pnpm docs:build
```

## Zero-Config docs mode

For quick previews in any markdown folder:

```bash
pnpm docs:dev:zero
```

Use this mode only for short experiments. For committed docs, use configured mode.

## Keywords

- [docmd](../reference/glossary.md#docmd)
- [Navigation](../reference/glossary.md#navigation)
- [Build](../reference/glossary.md#build)
