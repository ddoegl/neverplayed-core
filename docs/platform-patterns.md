# Platform Patterns: The Laws of Never Played

This document defines the overarching architectural patterns and best practices that govern all development within the Never Played ecosystem. These patterns are mandatory for **Core** and **Foundation** bundles and highly recommended for all other inhabitants.

---

## 1. Reactive State Synchronization ($watch)

To maintain consistency between the Shell (Host) and its inhabitants, we use the Alpine.js `$watch` pattern for cross-context synchronization.

- **Goal**: Prevent stale UI renders when global state (like selection or session) changes in the background.

### 📜 Related ADRs
- **[ADR-0002: Reactive State Synchronization](./adr/0002-reactive-state-synchronization.md)**

```html
<div x-data="{ localData: null }"
     x-init="$watch('$store.selection.activeId', id => { localData = fetchFromService(id); })">
  ...
</div>
```

---

## 2. Component Binding (Alpine + OSGi)

All dynamic UI inhabitants must bridge the OSGi module scope into the Alpine.js reactivity tree using the **Fresh Factory** pattern.

- **Isolation**: Segregate platform-level store (`Alpine.store('platform')`) from bundle-level logic to prevent namespace pollution.

### 📜 Related ADRs
- **[ADR-0016: Inhabitant Layer Sovereignty](./adr/0016-inhabitant-layer-sovereignty.md)**
- **[ADR-0019: Platform Namespace Isolation](./adr/0019-platform-namespace-isolation.md)**

---

## 3. Mandatory Constant Compliance

To prevent "magic string" fragmentation and broken service trackers, all OSGi identifiers (Services, PIDs, Topics) must be resolved via `core-types.js` (or `shared-types.js`).

- **Rule**: Never hardcode a service name in `registerService` or `trackService`.
- **Benefit**: Ensures system-wide refactor safety and discovery integrity.

### 📜 Related ADRs
- **[ADR-0013: Layered Architectural Constants](./adr/0013-layered-architectural-constants.md)**
- **[ADR-0001: Centralized Architectural Constants](./adr/0001-centralized-architectural-constants.md)**

---

## 4. Resilient Service Retrieval (On-Demand)

Avoid storing service references as long-lived class members. Instead, use an "On-Demand" lookup helper within your business logic methods.

- **Pattern**: Implement a `getSvc(sid)` helper that queries the `BundleContext` at the moment of execution.
- **Benefit**: Immune to OSGi race conditions and bundle restart cycles.

### 📜 Related ADRs
- **[ADR-0005: Resilient Service Retrieval](./adr/0005-resilient-service-retrieval.md)**
- **[ADR-0018: Service Hydration Handshake](./adr/0018-service-hydration-handshake.md)**

```javascript
const performAction = () => {
    const svc = this.getSvc(MY_SERVICE_ID);
    if (svc) svc.execute();
};
```

---

## 5. Defensive Data Normalization

Alpine.js reactivity can fail or behave unexpectedly if data types are inconsistent (e.g., iterating a string).

- **Pattern**: Always defensively normalize data (Array enforcement, Null guarding) before injecting it into the reactive state.
- **Benefit**: Prevents UI crashes and "zombie" state corruption.

### 📜 Related ADRs
- **[ADR-0012: Lifecycle Guards](./adr/0012-lifecycle-guards.md)**

---

## 6. The Dual-Bridge Pattern (OSGi + DOM)

When OSGi events need to trigger immediate UI updates in deeply nested inhabitants, use the "Dual-Bridge" approach.

1. **OSGi Bridge**: Post the event via `EventAdmin` for background service logic.
2. **DOM Bridge**: Dispatch a standard `CustomEvent` on `globalThis` to trigger local Alpine `@event.window` listeners.

### 📜 Related ADRs
- **[ADR-0004: Decoupled Cross-Flow Communication](./adr/0004-decoupled-cross-flow-communication.md)**

---

## 7. Strategic Data Shunting (Persistence)

Persisting data must follow the **Tiered Persistence Strategy** governed by the `Persistence Selector`.

- **Key Routing**: Always use the correct prefix for your data (e.g., `security.*` for memory-only, `identities.*` for local-fs).
- **Handshake**: Respect the `waitReady()` handshake for all asynchronous persistence providers.

### 📜 Related ADRs
- **[ADR-0003: Tiered Persistence Strategy](./adr/0003-tiered-persistence-strategy.md)**
- **[ADR-0009: Security Naming Convention](./adr/0009-security-naming-convention.md)**
- **[ADR-0021: Defensive Tier Fallback](./adr/0021-defensive-tier-fallback.md)**

---

## 9. Shunted Fallback (Stealth Tunnel)

To ensure high availability in restricted network environments, critical cloud services must implement a "Stateless Fallback" mechanism.

- **Pattern**: If the preferred transport (e.g., WebSockets/Firestore SDK) fails, "shunt" the operation to a REST-based HTTPS bridge.
- **Handshake**: Always use the reactive `waitReady()` promise to ensure the system doesn't attempt shunting before identity is established.

### 📜 Related ADRs
- **[ADR-0024: Dual-Mode Persistence Shunting](./adr/0024-dual-mode-persistence-shunting.md)**

---

## 10. Headless Secret Management (Ingress)

When deploying headless agents (MCP Servers), initial discovery and authorization require a pre-shared secret.

- **Pattern**: Use a static `x-mcp-secret` header for initial endpoint discovery and token minting requests.
- **Security**: The secret must be stored in Google Cloud Secret Manager and injected at runtime as an environment variable (`process.env.MCP_API_SECRET`).
- **Identity Bridge**: The secret is only used to mint a temporary Firebase Custom Token; business logic thereafter must transition to standard ID Token verification.

---

## 11. Archival Sovereignty (Physical Liquidation)

Hardened Domain Sovereignty requires that once an object is liquidated (archived/deleted), it must be physically removed from all persistence layers to maintain the **Single Point of Persistence (SPOP)** model.

- **Pattern**: Use physical field deletion (e.g., Firestore `deleteField()` or `Map.delete()`) instead of setting fields to `null`.
- **Benefit**: Ensures that "Discovery" algorithms (key listing) do not re-hydrate liquidated ghosts during synchronization.

### 📜 Related ADRs
- **[ADR-0029: Universal Interactor Service](./adr/0029-universal-interactor-service.md)**
- **[ADR-0030: Hybrid Action Handshake](./adr/0030-hybrid-action-handshake.md)**

---

## 12. Discovery Shield (Liquidated Graveyard)

To prevent re-hydration of "ghost instances" during asynchronous cloud synchronization, registries must implement a defensive discovery gate.

- **Pattern**: Maintain a transient **Liquidated Graveyard** (a Set of recently deleted IDs) and implement a **Debounced Discovery Pulse**.
- **Logic**: During discovery (e.g., `refreshMaster`), any discovered key found in the graveyard must be blocked from re-hydration.
- **Benefit**: Hardens the UI against "Resurrection Bugs" during high-latency synchronization cycles.

```javascript
 if (this._liquidatedIds.has(idPart)) {
     this.logger.debug(`[Registry] Blocked Discovery of Liquidated ID: ${idPart}`);
     continue;
 }
```
