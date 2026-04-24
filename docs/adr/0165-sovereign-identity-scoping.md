# ADR-0165: Sovereign Identity Scoping

## Status
Accepted

## Context
As the system evolved toward a multi-tenant, multi-identity architecture, we identified a critical race condition and state-drift phenomenon when switching user identities within specific realms. 

Previously, identity shifts (login/logout) often defaulted to a "Global" scope, which inadvertently overwrote the "Tenant Anchor" (UID). This led to:
1. **Vault "Ghosting"**: Data being stored in incorrect persistence shards.
2. **Persistence Purges**: Unintended liquidation of local data vaults because the tenant ID was incorrectly modified during identity shifts.
3. **Audit Gaps**: Bypassing of the `Session Service` API via direct property mutation in the reactive Alpine store.

## Decision
We implement a **Sovereign Identity Scoping** strategy composed of three pillars:

### 1. Hierarchical Context Sharding
All sovereign persistence must utilize the hierarchical key structure:
`np:v1:${tenantId}:${identityId}:${realmId}:${key}`
- **Tenant ID**: Managed as the "Global Anchor" in `scopedUsers["global"]`.
- **Identity ID**: Managed as the flow-scoped identity in `currentUser`.
- **Realm ID**: Managed as the active context world.

### 2. Layered Push-Synchronization
We enforce a "Push-Down" architectural rule:
- **Rule**: The `Realm Manager` (Layer 2) is responsible for explicitly updating the `Session Service` (Layer 1) with the current `activeRealmId` upon a successful context transition.
- **Rationale**: This prevents Layer 1 from depending on Layer 2 service tracking, maintaining proper infrastructural isolation.

### 3. Context-Aware Identity Defaulting
The `Session Service` must dynamically resolve the target scope for any identity operation (Login, Logout, Persistence Sync) following this priority:
1. `activeFlowId` (Specific UI Flow)
2. `activeRealmId` (Active World)
3. `global` (Tenant Anchor)

### 4. Forensic Mutation Monitoring
The `Session Service` implements an internal `Alpine.effect` watcher that audits mutations to the `scopedUsers` object. This provides a forensic trail to detect and log accidental direct state mutations that bypass the formal API.

## Consequences
- **Positive**: Eliminated unintended vault purges during identity shifts.
- **Positive**: Restored "Front-Door" traceability for all login/logout events.
- **Positive**: Simplified CLI-based identity management via dedicated `/login` and `/logout` commands.
- **Negative**: Increased complexity in the `Session Service` to handle multi-level scope resolution.
- **Neutral**: Requires `Realm Manager` to have a hard dependency (or tracker) on `Session Service`.

## Related ADRs
- [ADR-0140: Sovereign Shield](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0140-sovereign-shield.md) (Foundation)
- [ADR-0151: Resilient Persistence Sovereignty](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0151-resilient-persistence-sovereignty.md) (Sharding logic)
- [ADR-0012: Lifecycle Guards](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0012-lifecycle-guards.md) (Persistence triggers)
