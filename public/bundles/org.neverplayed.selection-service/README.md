# 🛡️ Selection Service Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Infrastructure for managing the "Active Selection" in the shell, enabling context-aware actions and cross-bundle communication.

## 🏛️ Architecture & Implementation

- **Selection Store**: Maintains a reactive list of selected domain objects and their UIDs.
- **Service Registration**: Registers the `SELECTION_SERVICE`.
- **Event Bus Integration**: Signals selection changes to allow other bundles (like `Shell Sidebar`) to react.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Reactive State Synchronization** (Pattern 1) and **Resilient Service Retrieval** (Pattern 8/ADR-0005).
- **[ADR-0002: Reactive State Synchronization](../../docs/adr/0002-reactive-state-synchronization.md)**: Proves the effectiveness of using the selection store for real-time UI updates.

## 🚀 Future Road

- **Multi-Selection Logic**: Better support for bulk actions (select all, invert selection).
- **Persistent Selection**: Option to remember selection across short-lived page reloads.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
