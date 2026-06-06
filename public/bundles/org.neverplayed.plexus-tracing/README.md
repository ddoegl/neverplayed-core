# 📊 Plexus Tracing UI
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


Diagnostic flow visualization interface for tracking Plexus matching events and decisions.

## 🏛️ Architecture & Implementation

Provides an Alpine-backed administrative UI showing real-time sensing traces, matching outcomes, and active rules across entities in the environment.

- **Trace Visualizer**: Displays historical matching evaluations.
- **Flow Interface**: Implements `org.neverplayed.flow.FlowService` to integrate into the administrative host shell.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Standardizes platform monitoring components.
- **[ADR-0004: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Directs event flow mapping.

## 🚀 Future Road

- Add filtering controls for specific entity traces.

### 🏺 Institutional ADRs

- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.

- [ADR-0025](../../docs/adr/000025-...)
- [ADR-0026](../../docs/adr/000026-...)
- [ADR-0027](../../docs/adr/000027-...)

### Referenced Constants:
- `FLOW_SERVICE`
- `CONFIG_ADMIN_SERVICE`
- `PLEXUS_ENGINE_SERVICE`
- `PLEXUS_PID`
- `LOG_SERVICE`
- `PLEXUS_SENSOR_SERVICE`
