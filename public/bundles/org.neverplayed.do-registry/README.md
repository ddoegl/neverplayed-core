# 🛡️ DO Registry Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Central registry for **Domain Object (DO)** blueprints, providing a unified access point for metadata, schemas, and semantic types.

## 🏛️ Architecture & Implementation

- **Blueprint Repository**: Stores metadata for every recognized domain object in the system.
- **Service Interface**: Registers the `DO_REGISTRY_SERVICE`.
- **Dynamic Registration**: Allows realms to "surge" new domain object definitions into the system during transitions.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Early Boot Registration** (Pattern 20/ADR-0020) and **Constant Compliance** (Pattern 3/ADR-0013).
- **[ADR-0020: Early Boot Registration Buffer](../../docs/adr/0020-early-boot-registration-buffer.md)**: Implements the buffering logic to capture DO registrations that occur before the UI or backend is fully hydrated.
- **[ADR-0006: Realm Ontology](../../docs/adr/0006-realm-ontology.md)**: Ensures domain objects are scoped to their respective architectural layers.

## 🚀 Future Road

- **Schema Mirroring**: Support for automatic UI generation based on JSON Schemas provided by the blueprints.
- **Cross-Realm Replication**: Allow some domain objects to be shared between independent realm clusters.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
