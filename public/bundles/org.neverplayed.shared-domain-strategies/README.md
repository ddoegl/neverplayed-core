# 🛡️  "Bundle-SymbolicName": "org.neverplayed.shared-domain-strategies",
  "Bundle-Version": "0.2.0",
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Global repository for domain-specific business logic patterns and strategy services.

## 🏛️ Architecture & Implementation

- **Strategy Engine**: Implements the strategy design pattern-   **[SPOP] Single Point of Persistence**: Decommissions legacy collective blueprint maps. All instance data is persisted in atomic, stand-alone buckets via the `DO-Registry`.
-   **Gravity-Aware Resolution**: Determines the persistence tier (Local/Cloud) based on the realm hierarchy and security policies.
 used by both backoffice and user flows.

## 🏛️ The Patterns (The State)

- **[Pattern 20: Early Boot Registration](../../docs/platform-patterns.md)**: Strategies register during the foundation boot cycle.
- **[ADR-0032: Lexical Key Ordering](../../docs/adr/0032-lexical-key-ordering-standard.md)**: Governs step and part sequence authority.
iance** (Pattern 3/ADR-0013) and **Early Boot Registration** (Pattern 20/ADR-0020).
- **[ADR-0020: Early Boot Registration Buffer](../../docs/adr/0020-early-boot-registration-buffer.md)**: Ensures that foundational strategies are buffered and captured during high-throughput booting.
- **[ADR-0013: Layered Architectural Constants](../../docs/adr/0013-layered-architectural-constants.md)**: Ensures consistent strategy PIDs for cross-layer lookups.

## 🚀 Future Road

- **Dynamic Strategy Injection**: Allow realms to provide their own strategy overrides for standard operations.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
