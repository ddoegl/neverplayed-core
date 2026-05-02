# 🛡️ Session Service Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Identity Purity Guardian** that manages reactive user state, scoped authorizations, and session persistence.

## 🏛️ Architecture & Implementation

- **Multi-Persona Residency**: Supports the `scopedUsers` registry pattern, allowing multiple identities to inhabit a single coordinate simultaneously in an Identity Stack.
- **Being Gravity (Sovereign Focus)**: Implements the "Session Soul" pattern, where a non-global login automatically promotes an identity to the session-wide Being focus, ensuring it persists across stratum jumps.
- **Global Identity Anchoring**: Automatically registers every new identity in the `global` stack, ensuring universal recognition for Carry-over and Materialization lookups.
- **Institutional Persistence Sync**: Centralizes persistence context shunting. Watches `session.tier` and atomically synchronizes the `PersistenceManager` with the full [Tenant/Identity/Realm/Tier] coordinate (ADR-0170). 🪐🛡️🔍
- **Identity Hierarchy**: Implements **Sovereign Identity Scoping (ADR-0165)**, prioritizing `activeFlowId` over `activeRealmId`.
- **Forensic Auditing**: Features a **Mutation Forensic Guard** that monitors the reactive store for direct property assignments.
- **Identity Purity Sink**: Uses an `Alpine.effect` to sanitize identity stacks (stripping sensitive guest metadata) before persisting to the requested tier.

## 🏛️ The Patterns (The State)

- **[Identity Registry Stack (ADR-0170)](../../docs/adr/0170-multi-persona-residency.md)**: Manages multi-persona portfolios within a single coordinate. Identity switching is an `__activeId__` pivot, not a destructive overwrite. 🛡️👤
- **[Institutional Persistence Sync (ADR-0170)](../../docs/adr/0170-multi-persona-residency.md)**: Acts as the system's "Master Shunt," ensuring the storage tier is always in sync with navigational intent. 🪐🛡️
- **[ADR-0165: Sovereign Identity Scoping](../../docs/adr/0165-sovereign-identity-scoping.md)**: Establishes the rule of **Hierarchical Sharding** and **Push-Synchronization** from the Realm Manager. 🛡️🪐

## 🚀 Future Road

- **Sovereign Capability Filters**: Implement Level 0 authorization filters that restrict domain object visibility based on the active persona's capabilities.

### 🏺 Institutional ADRs
- [ADR-0140](../../docs/adr/0140-sovereign-shield.md) - Sovereign Shield (CLI Normalization). 🛡️👤
- [ADR-0165](../../docs/adr/0165-sovereign-identity-scoping.md) - Sovereign Identity Scoping (Hierarchical Sharding). 🛡️🪐
- [ADR-0170](../../docs/adr/0170-multi-persona-residency.md) - Multi-Persona Identity Residency (Portfolios & Shunting). 🪐🛡️
- [ADR-0175](../../docs/adr/0175-sovereign-being-lifecycle-gravity.md) - Sovereign Being Lifecycle & Focus Gravity. 🧬✨
