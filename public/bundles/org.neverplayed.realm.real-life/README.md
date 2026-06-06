# 🌍 Realm: Real Life
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


The **Real Life Realm** bundle is a specialized domain layer for testing and demonstration. It implements the core "Persona Selection" logic and showcases how realms can manage their own inhabitants.

## 🏛️ Architecture & Implementation

- **Persona Orchestration**: Manages the transition between different user personas (e.g., "Beginner", "Advanced") by hot-patching the `GEMINI.md` constitution and the active flow set.
- **Demo Registry**: provides a set of mock domain objects and actions specific to the "Real Life" scenario.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Inhabitant Layer Sovereignty** (Pattern 6/ADR-0016) and **Realm Fragmentation** (ADR-0006).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Complex Simulations**: Integration with the `PlexusEngine` for real-time domain strategy simulation.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `FLOW_SERVICE`
- `CONFIG_ADMIN_SERVICE`
- `_CONFIG_ADMIN_SERVICE`
- `ENV_SERVICE`
- `SESSION_SERVICE`
- `PERSONS_SERVICE`
- `COMPANIES_SERVICE`
- `TENANT_DATA_SERVICE`
- `LICENSE_DATA_SERVICE`
- `FELLOWS_SERVICE`
- `_FELLOWS_SERVICE`
