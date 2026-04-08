# 🛡️ Persistence Selector Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Strategic Data Shunt** that routes data to different storage tiers based on dynamic policies and environment state.

## 🏛️ Architecture & Implementation

- **Tiered Shunting**: Routes data between `Cloud` (Firebase), `local-browser` (LocalStorage), and `Volatile` (Memory).
- **WaitReady Handshake**: Implements a synchronization promise that ensures consumers wait for infrastructure (e.g., Firebase Auth) before attempting I/O.
- **Policy Engine**: Uses a simple pattern-matching engine to decide the "Gravity" of data (e.g., `identities.*` always land on `local-browser`).

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Strategic Data Shunting** (Pattern 7) and the **Defensive Tier Fallback** (Pattern 5/ADR-0021).
- **[ADR-0003: Tiered Persistence Strategy](../../docs/adr/0003-tiered-persistence-strategy.md)**: Implements the 4-tier storage model (Memory, Local-FS, Browser, Cloud).
- **[ADR-0018: Service Hydration Handshake](../../docs/adr/0018-service-hydration-handshake.md)**: Exposes the `waitReady()` method to allow consumers to safely synchronize with asynchronous storage providers.

## 🚀 Future Road

- **Persistence Migration**: Implement a "Data Surge" protocol to move data between tiers when a new provider (e.g., Cloud) becomes available during a session.
- **Conflict Resolution**: Add a pluggable reconciliation strategy for the Cloud tier using CRDTs.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
