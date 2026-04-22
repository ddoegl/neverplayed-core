# 🛡️ Strategic Persistence Selector

![Documentation Health](https://img.shields.io/badge/Documentation-Health-green)

The **Strategic Data Shunt** orchestrates data operations between volatile, local, and cloud storage tiers based on dynamic policies and environmental constraints.

## 🏛️ Architecture & Implementation

This bundle acts as a virtual `PersistenceManager` service with a high `service.ranking` (1000). It intercepts all I/O and routes it to the appropriate physical provider.

- **Opportunistic Hydration**: Implements a "Lax Read" pattern—if a key is missing in its preferred tier, the selector performs a deep scan of all other connected providers to recover data.
- **Provisioning Gate**: Implements a unified `waitReady()` handshake that prevents "Thundering Herd" stalls during asynchronous infrastructure warmups.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Strategic Data Shunting** and **Defensive Tier Fallback**.
- **[ADR-0152: Discovery-Driven Persistence Aggregation](../../docs/adr/0152-discovery-driven-persistence-aggregation.md)**: Implements the "Discovery Pulse" model, scanning all tiers via `listKeys()` to provide a unified view of the universe.
- **[ADR-0151: Resilient Persistence Sovereignty](../../docs/adr/0151-resilient-persistence-sovereignty.md)**: Enforces "Absolute Ceiling" constraints from `env.json` to prevent unwanted cloud communication.
- **[ADR-0024: Dual-Mode Persistence Shunting](../../docs/adr/0024-dual-mode-persistence-shunting.md)**: Supports "Stealth Mode" operations where data is routed to an in-memory volatile store instead of persistent storage.

## 🚀 Future Road

- **Conflict Reconciliation**: Moving from "Last Write Wins" to pluggable CRDT-based reconciliation for cloud tiers.
- **Auto-Sync Tasks**: Background synchronization of local-only objects to the cloud once connectivity is established.

### 🏺 Institutional ADRs

- [ADR-0003](../../docs/adr/0003-tiered-persistence-strategy.md) - Tiered Persistence Strategy.
- [ADR-0021](../../docs/adr/0021-defensive-tier-fallback.md) - Defensive Tier Fallback.
- [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic Versioning.
