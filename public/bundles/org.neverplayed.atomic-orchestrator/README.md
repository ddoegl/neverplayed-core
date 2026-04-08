# 🛡️ Atomic Orchestrator Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Computational engine for evaluating **Atomic Rules**, managing semantic flows, and coordinating complex business logic.

## 🏛️ Architecture & Implementation

- **Rule Evaluator**: Processes logic rules defined in YAML blueprints.
- **Flow State Manager**: Maintains the "Step State" for multi-phase user journeys.
- **Orchestration Service**: Registers the `ATOMIC_ORCHESTRATOR_SERVICE`.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Service Hydration Handshake** (Pattern 18/ADR-0018) and **Early Boot Registration** (Pattern 20/ADR-0020).
- **[ADR-0020: Early Boot Registration Buffer](../../docs/adr/0020-early-boot-registration-buffer.md)**: Prevents registration loss during fast-boot scenarios where consumers are not yet ready.
- **[ADR-0014: Multi-Phase Boot](../../docs/adr/0014-multi-phase-boot.md)**: Participates in the orchestration phase, hydrating business logic once foundation services are stable.

## 🚀 Future Road

- **Cloud rule offloading**: Execute sensitive rules on the backend while maintaining local UI reactivity.
- **Flow Visualizer**: Real-time visualization of active flows directly in the Shell CLI.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
