# DirtOS Architecture

## Frontend

- React 19 with TanStack Router for routing.
- Mantine for the application shell, inputs, dashboards, and overlays.
- Zustand for lightweight UI and canvas state.
- React Query for Tauri command-backed data loading and caching.
- Konva for the 2D garden editor and React Three Fiber for the 3D scene.

## Backend

- Tauri 2 hosts the desktop shell.
- Rust command modules expose domain operations to the frontend.
- SQLite is the primary local data store.
- Services handle weather, sensors, media storage, backup/export, scheduling, and integrations.

## Startup

1. Tauri resolves the application data directory.
2. DirtOS initializes SQLite, runs migrations, and seeds reference data.
3. If startup fails, DirtOS attempts recovery from the latest database backup.
4. Once ready, scheduler, sensor polling, and periodic backups start in the background.

## Data Safety

- WAL mode is enabled for SQLite.
- Periodic database snapshots are written to the backups directory.
- Full garden JSON exports include table data plus stored media content.
