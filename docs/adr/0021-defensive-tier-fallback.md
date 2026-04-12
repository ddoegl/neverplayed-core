# 21. Defensive Tier Fallback Strategy

Date: 2026-04-06

## Status

Accepted

## Context

In a "Bring Your Own Realm" (BYOR) architecture, the persistence infrastructure
available to different realms can vary. A realm may request a `cloud` tier that
isn't provisioned, or it may rely on a `local` tier while the system has moved
to more specific `local-fs` and `local` identifiers. Hardcoded failures when a
specific provider is missing leads to complete system breakdown and data loss.

## Decision

Implement a **Defensive Tier Fallback** strategy within the
`PersistenceSelector`.

1. **Unified Identifiers**: Harmonize the persistence tier by standardizing on `local` for the browser's local storage, eliminating the ambiguity between `local` and `local-browser`.
2. **Fallback Chain**: When a specific tier provider is requested but not
   present, the Selector must follow a deterministic fallback chain:
   - `requestedTier` -> `local` -> `volatile` (Memory)
3. **WaitReady Resilience**: The `waitReady()` handshake must also follows the
   fallback chain to prevent infinite hangs when waiting for missing
   infrastructure.

## Consequences

- **Resilience**: The system remains functional even if high-level persistence
  providers (e.g., Firebase) fail to initialize.
- **Data Preservation**: Data that cannot be synced to the cloud is preserved in
  the browser's local storage or memory rather than being discarded.
- **Explicit Mapping**: Prevents "identifier drifting" by standardizing on
  `local` as the canonical browser storage identifier.
