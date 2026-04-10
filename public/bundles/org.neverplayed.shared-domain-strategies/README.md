# 🛡️ Shared Domain Strategy Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Global repository for domain-specific business logic patterns and strategy services.

## 🏛️ Architecture & Implementation

- **Strategy Engine**: Implements the strategy design pattern used by both backoffice and user flows.
- **[SPOP] Instance Persistence**: Decommissions legacy collective instance maps. Every instance is persisted in its own sovereign bucket (`realm.do.instances_{id}`) to ensure atomic property lifecycle. 🏺
- **Gravity-Aware Resolution**: Determines the persistence tier (Local/Cloud) based on the realm hierarchy and security policies.

## 🏛️ The Patterns (The State)

- **[Pattern 20: Early Boot Registration](../../docs/platform-patterns.md)**: Strategies register during the foundation boot cycle using the **Early Boot Registration Buffer** (Pattern 20/ADR-0020).
- **[ADR-0013: Layered Architectural Constants](../../docs/adr/0013-layered-architectural-constants.md)**: Ensures consistent strategy PIDs for cross-layer lookups.
- **[ADR-0032: Lexical Key Ordering](../../docs/adr/0032-lexical-key-ordering-standard.md)**: Governs step and part sequence authority for flow blueprints.

## 🚀 Future Road

- **Dynamic Strategy Injection**: Allow realms to provide their own strategy overrides for standard operations.

### 🏺 Institutional ADRs
- [ADR-0001](../../docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](../../docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
