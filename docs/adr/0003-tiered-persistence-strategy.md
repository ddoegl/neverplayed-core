# 3. Tiered Persistence Strategy (Data Shunting)

Date: 2026-04-06

## Status

Accepted

## Context

The system must handle data with varying sensitivity and accessibility needs, ranging from cloud-synced configurations to volatile secrets that should never leave memory. Standard persistence managers often require manual key authorization, leading to "unmanaged key" warnings.

## Decision

Implement a **PersistenceSelector** that acts as a Strategic Data Shunt. It routes data to specific tiers based on key prefixes:
- `volatile`: Targeted by `security.*`. Memory-only.
- `local`: Targeted by `realm.*`, `identities.*`. Persisted on-device.
- `cloud`: Targeted by `config.*`. Synchronized via Firebase.

The Selector also implements an **Automatic Key Registration** logic to intercept new keys and authorize them with the underlying provider without manual developer intervention.

## Consequences

*   **Security by Default**: Sensitive data is automatically shunted to volatile memory.
*   **Flexibility**: Data gravity is determined by prefixes rather than hardcoded logic in services.
*   **Transparency**: Automatic key registration removes console noise and simplifies development.
*   **Dependency**: Requires all bundles to use the `PersistenceSelector` service for state management.
