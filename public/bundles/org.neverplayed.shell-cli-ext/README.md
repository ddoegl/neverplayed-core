# 📑 Shell CLI Extensions
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


The **Shell CLI Extensions** bundle provides a collection of advanced management commands that extend the base functionality of the `ShellCLI`.

## 🏛️ Architecture & Implementation

- **Decoupled Commands**: Registers individual `SHELL_COMMAND_SERVICE` instances for specialized tasks like `inspect`, `matrix`, or `registry-clean`.
- **Context Awareness**: Commands receive the full `BundleContext` to perform deep system inspection.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Plugin Orchestration** (ADR-0013).
- **[ADR-0012: Lifecycle Guards](../../docs/adr/0012-lifecycle-guards.md)**: Ensures extensions do not block the main shell loop during extraction.

## 🚀 Future Road

- **Visual Inspections**: Commands that can trigger UI overlays for data visualization.
- **Snapshot Support**: Commands to export/import the current service registry state.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `SESSION_SERVICE`
- `SELECTION_SERVICE`
- `PERCEIVER_SERVICE`
