# Developer Guide

## Requirements

- Node.js from `.nvmrc`
- pnpm
- Rust toolchain
- Tauri prerequisites for your platform

## Local Setup

1. `nvm use`
2. `pnpm install`
3. `pnpm dev`

## Useful Commands

- `pnpm dev`: run the desktop app in development mode
- `pnpm build`: create a release build
- `pnpm type-check`: run TypeScript checks
- `pnpm lint`: run ESLint
- `pnpm generate-bindings`: regenerate Tauri bindings

## Project Structure

- `src/`: React app, routes, features, stores, shared components
- `src-tauri/src/`: Rust commands, database modules, services, events
- `src-tauri/migrations/`: SQLite schema and migration history
- `assets/`: source logos, icons, and theme imagery
- `docs/`: phase notes and architecture/user docs

## Contribution Notes

- Prefer minimal, focused changes.
- Use `apply_patch` style edits for text files when working through the agent workflow.
- Keep frontend and backend types aligned through generated bindings.
- Validate both TypeScript and Rust changes before shipping.
