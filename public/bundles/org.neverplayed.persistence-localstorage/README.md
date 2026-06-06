# 🏛️ LocalStorage Persistence Provider

![Documentation Health](https://img.shields.io/badge/Documentation-Health-green)

The **Institutional LocalStorage Provider** provides a standard-compliant implementation of the `PersistenceManager` service backed by the browser's `localStorage` API. It is designed to replace external vendor implementations and support the project's multi-tier discovery architecture.

## 🏛️ Architecture & Implementation

- **Service Interface**: Provides `@pandino/persistence-manager/PersistenceManager` with a `service.ranking` of `25`.
- **Discovery Pulse**: Implements `listKeys(prefix)` to allow the `PersistenceSelector` to find local data during deep scans.
- **Deterministic Handshake**: Implements `waitReady()` to ensure consumers wait for storage availability.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Strategy**.
- **[ADR-0152: Discovery-Driven Persistence Aggregation](../../docs/adr/0152-discovery-driven-persistence-aggregation.md)**: Implements the `listKeys` contract to participate in discovery aggregation.
- **[ADR-0003: Tiered Persistence Strategy](../../docs/adr/0003-tiered-persistence-strategy.md)**: Serves as the authoritative source for the `local` tier (Browser scope).

## 🚀 Future Road

- **Encryption at Rest**: Optional AES encryption for sensitive local keys.
- **Quota Monitoring**: Alerts when localStorage exceeds 5MB limits.

### 🏺 Institutional ADRs

- [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md) - Identity Injection & ID Tokens.
- [ADR-0026](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Reactive Non-Destructive Variable Resolution.
- [ADR-0151](../../docs/adr/0151-resilient-persistence-sovereignty.md) - Resilient Persistence Sovereignty.
- [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic Versioning.


### Referenced Constants:
- `PERSISTENCE_MANAGER_SERVICE`
- `SHELL_UI_CONTEXT_PID`
