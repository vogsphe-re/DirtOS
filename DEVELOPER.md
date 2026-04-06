# Developer Guide

## Requirements

- Node.js >22 from `.nvmrc`
- pnpm
- Rust toolchain
- Tauri prerequisites for your platform

## Local Setup

1. `nvm use 22 --lts`
2. `npm i -g pnpm`
3. `pnpm install`
4. `pnpm dev`

## Useful Commands

- `pnpm dev`: run the desktop app in development mode
- `pnpm build`: create a release build
- `pnpm type-check`: run TypeScript checks
- `pnpm lint`: run ESLint
- `pnpm generate-bindings`: regenerate Tauri bindings

## REST API

The API server starts automatically when DirtOS launches. While `pnpm dev` is
running:

```bash
curl http://127.0.0.1:7272/api/v1/health
```

For interactive testing, open `api/swagger-ui.html` in a browser or import
`api/DirtOS.postman_environment.json` into Postman.

Set `DIRTOS_API_PORT` to use a different port:

```bash
DIRTOS_API_PORT=8080 pnpm dev
```

## Project Structure

- `src/`: React app, routes, features, stores, shared components
- `src-tauri/src/`: Rust commands, database modules, services, events
- `src-tauri/src/api/`: REST API server (axum) and route handlers
- `src-tauri/migrations/`: SQLite schema and migration history
- `api/`: OpenAPI spec, Swagger UI, and Postman environment for the REST API
- `assets/`: source logos, icons, and theme imagery
- `docs/`: phase notes and architecture/user docs
- `scripts/`: scripts for build+release, database maintenance

## Contribution Notes

- Prefer minimal, focused changes.
- Use `apply_patch` style edits for text files when working through the agent workflow.
- Keep frontend and backend types aligned through generated bindings.
- Validate both TypeScript and Rust changes before opening pull requests.
