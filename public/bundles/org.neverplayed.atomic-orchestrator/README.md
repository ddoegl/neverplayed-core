# 🛡️ Atomic Orchestrator Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Computational engine for evaluating **Atomic Rules**, managing semantic flows, and coordinating complex business logic.

## 🏛️ Architecture & Implementation

- **Rule Evaluator**: Processes logic rules defined in YAML blueprints.
- **Flow State Manager**: Maintains the "Step State" for multi-phase user journeys.
- **Orchestration Service**: Registers the `ATOMIC_ORCHESTRATOR_SERVICE` to manage reactive flows.
- **Spec Ingestion**: Registers the `ATOMIC_SPEC_INGESTION_SERVICE` to handle remote and dynamic blueprint registration.
- **CLI Commands**: Registers the `SHELL_COMMAND_SERVICE` providing `atomic:list` and `atomic:refresh` diagnostics.
- **Security Provisioning**: Tracks and configures `PERMISSION_DATA_SERVICE`, `FEATURE_DATA_SERVICE`, and `CAPABILITIES_DATA_SERVICE` based on blueprint metadata.
- **Proactive Discovery**: Implements the **Proactive Discovery Orchestration** (ADR-0031) to ensure zero-loss boot-time ingestion.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Service Hydration Handshake** (Pattern 18).
- **[ADR-0025: Identity Injection](../../docs/adr/0025-identity-injection-id-tokens.md)**: Governs global identity injection.
- **[ADR-0026: Reactive Variable Resolution](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md)**: Implements variable resolution.
- **[ADR-0027: Semantic Bundle Versioning](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)**: Governs bundle versioning.
- **[ADR-0028: Tiered Bundle Testing Strategy](../../docs/adr/0028-tiered-bundle-testing-strategy.md)**: Defines testing standards.
- **[ADR-0029: Universal Interactor Service](../../docs/adr/0029-universal-interactor-service.md)**: Decouples logic from UI side-effects.
- **[ADR-0030: Hybrid Action Architecture](../../docs/adr/0030-hybrid-action-handshake.md)**: Standardizes handshakes.
- **[ADR-0031: Proactive Discovery Orchestration](../../docs/adr/0031-proactive-discovery-orchestration.md)**: Governs boot-time spec ingestion.

## 🚀 Future Road

- **Cloud rule offloading**: Execute sensitive rules on the backend whilst maintaining local UI reactivity.
- **Flow Visualizer**: Real-time visualization of active flows directly in the Shell CLI.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
