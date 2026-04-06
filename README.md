# DirtOS

![DirtOS Splash](assets/DirtOS.png)

DirtOS is a local-first desktop platform for planning, tracking, and
operating home gardens. It combines visual garden design, plant lifecycle
tracking, schedule automation, issue management, and sensor-aware monitoring
in one application.

## Highlights

- 2D/3D garden planning for outdoor and indoor spaces
- Species catalog with enrichment support (iNaturalist, Wikipedia, and
  additional providers)
- Individual plant tracking with lifecycle status and asset tags
- Seedling trays and observation history for propagation workflows
- Indoor grow environment telemetry and reservoir target management
- Recurring schedules for watering, feeding, treatment, and maintenance
- Sensor readings, threshold limits, and condition-driven issue workflows
- Journal timeline, harvest logs, and reporting support
- Local backup/export/import with media-aware data portability

## Requirements

- Node.js 20+ (see `.nvmrc`)
- `pnpm`
- Rust toolchain (for Tauri backend)

## Quick Start

```bash
pnpm install
pnpm dev
```

## Documentation (docmd)

DirtOS docs are generated and maintained with `docmd`.

```bash
pnpm docs:dev
pnpm docs:build
```

Docs source lives in `docs/` and is configured by `docmd.config.js`.

### Primary docs entry points

- [Docs Home](docs/index.md)
- [Getting Started](docs/getting-started/first-run.md)
- [Feature Reference](docs/reference/feature-matrix.md)
- [Architecture Reference](docs/reference/architecture.md)
- [Developer Guide](DEVELOPER.md)
- [Contributing](CONTRIBUTING.md)

## Example Garden

DirtOS can generate and install a realistic example dataset for onboarding and
feature exploration.

- Installed path: `~/Documents/DirtOS/Examples/DirtOS-Example-Garden.json`
- Import flow and coverage details: [Example Garden Guide](docs/getting-started/example-garden.md)

## License and contribution

Contribution guidelines are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
