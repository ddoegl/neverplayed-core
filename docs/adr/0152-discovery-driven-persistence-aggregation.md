# ADR-0152: Discovery-Driven Persistence Aggregation

## Status
Accepted

## Context
As the Never Played persistence architecture evolved into a multi-tier model (Memory, Local-FS, Browser, Cloud), the "Closed World" assumption of managed keys became a significant bottleneck.

Primary issues identified:
1. **Discovery Gaps**: Domain objects persisted in secondary tiers (e.g., LocalStorage) were invisible during realm transitions unless explicitly registered in a "Managed Keys" list.
2. **Configuration Fragility**: Manual key registration created a high risk of "Resolution Amnesia" where data was present in a tier but the system didn't know it should look for it.
3. **Registry Blindness**: The Domain Object Registry could not efficiently visualize the state of the universe across all tiers without a unified discovery pulse.

## Decision
We implement a **Discovery-Driven Aggregation** pattern centered on the asynchronous `listKeys(prefix)` capability.

1. **Contract Requirement**: Every `PersistenceManager` implementation (Provider) MUST implement `listKeys(prefix)` to return an array of keys currently present in its tier.
2. **The Discovery Pulse**: The `PersistenceSelector` (Data Guardian) aggregates keys from ALL tracked providers regardless of their tier ranking or routing preference.
3. **Open Discovery model**: We phase out the `managedKeys` / `pandino.pm.managed-keys` registration requirement. If data exists in any tier, it is considered discoverable.
4. **Diagnostic Transparency**: Provide `pm:list` and `pm:status` shell commands to allow real-time inspection of the aggregated key-space.

## Consequences
- **Positive**: Zero-config hydration for secondary tiers; the Domain Object Registry can now accurately reflect the cross-tier state of the universe.
- **Positive**: Decouples "Existence" from "Policy"—we can find data even if the routing policy doesn't currently point to that tier.
- **Negative**: Increased I/O overhead during massive discovery pulses (mitigated by prefix filtering).
- **Compliance**: This ADR supplements **[ADR-0151: Resilient Persistence Sovereignty](./0151-resilient-persistence-sovereignty.md)** by providing the discovery mechanism for sovereign data routing.
