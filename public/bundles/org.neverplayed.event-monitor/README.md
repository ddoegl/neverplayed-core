# 🛡️ Event Monitor Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Real-time diagnostic tool for visualizing OSGi service events, lifecycle changes, and EventAdmin signals.

## 🏛️ Architecture & Implementation

- **Event Tracker**: Tracks all OSGi events and stores them in a circular buffer in memory.
- **Micro-UI**: Direct DOM mount for the monitor panel (toggled via hotkey).
- **Reactive Stream**: Uses Alpine.js to update the event stream live as it happens.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Dual-Bridge Reactivity** (Pattern 6/ADR-0004) to monitor both background and foreground signals.
- **[ADR-0004: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Proves the effectiveness of the EventAdmin and the decoupling between bundles.

## 🚀 Future Road

- **Replay Protocol**: Record and replay event streams to reproduce race conditions.
- **Direct Filter**: Add the ability to filter by event type or bundle BSN directly in the UI.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
