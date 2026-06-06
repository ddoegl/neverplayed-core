# 🛡️ Persistence Resolver Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Decision Authority** for multi-layered persistence resolution, ensuring that data is shunted accurately between realms and storage providers.

## 🏛️ Architecture & Implementation

- **Resolution Hierarchy**: Implements the logic for resolving which `PersistenceService` to use for a particular key.
- **Layer Mapping**: Connects the 5-layer ontology to specific technical storage PIDs.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Resolution** (Pattern 7/ADR-0003) and **Defensive Fallback** (Pattern 21/ADR-0021).
- **[ADR-0003: Tiered Persistence Strategy](../../docs/adr/0003-tiered-persistence-strategy.md)**: Core logic for tier resolution and fallback management.

## 🚀 Future Road

- **Pluggable Resolvers**: Allow realms to bring their own resolution logic for domain-specific keys.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `PERSISTENCE_RESOLVER_SERVICE`
- `REALM_MANAGER_SERVICE`
