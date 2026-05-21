# Inhabitation Architecture
_Author: Forensic Analyst — 2026-05-21_
_Based on: ground-truth source inspection of stratum-core, session-service, realm-manager, perceiver-service, stratographer_

---

## 1. The Data Model: `scopedUsers`

Everything roots in the `session-service`'s Alpine reactive `scopedUsers` map
([session-service/activator.js L100–L118](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js#L100-L118)):

```
scopedUsers = {
  "global":                             { __activeId__: "uid1",  "uid1": { id, email, surrogates, … } },
  "org.neverplayed.realm.habitat":      { __activeId__: "rob",   "rob":  { id, … }, "july": { id, … } },
  "org.neverplayed.realm.governance":   { __activeId__: "rob",   "rob":  { id, … } }
}
```

- **Outer key** = scope ID (a realm ID, flow ID, or `"global"`)
- **Inner keys** = identity IDs + the special `__activeId__` sentinel
- `"global"` is the **Tenant Anchor** — the organisational root, never scoped to any realm
- Each realm key is an independent **residency stack**, supporting multiple simultaneous inhabitants (ADR-0170)
- Non-destructive switching: changing the active identity only pivots `__activeId__`; all other identity records remain in the stack

---

## 2. Two Concepts: *Residents* vs *Inhabitants*

These are different and computed differently:

| Concept | Source | Method | Cost |
|---------|--------|--------|------|
| **Residents** | `scopedUsers[realmId]` stack | `stratum.residents` getter | Synchronous, cheap |
| **Inhabitants** | PM persistence + session stack | `stratum.getInhabitants()` | Async, forensic, expensive |

### `residents` — [stratum-core L73–L78](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L73-L78)
Returns all identity IDs that have an entry in the current realm's session stack (excluding `guest` and `__activeId__`).
Tells you: *who has logged into this realm in this session.*

### `getInhabitants()` — [stratum-core L92–L113](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L92-L113)
1. Scans all PM keys via `listKeys("")` + `probe(key)`
2. Adds `identityId` for any key whose `context.realmId` matches the current realm
3. Also scans `scopedUsers[currentRealm]` for live session residents
4. Also adds `currentUser.id`
5. Returns the union, minus guests

Tells you: *who has ever left data in this realm* — a forensic cross-check across persistence and session.

---

## 3. How Inhabitation Is Established: The Login Chain

```
stratum.jump("np://tenant/realm/identity/…")
  → realm-manager.coordinateTransition({ realmId, identityId })
      → [Phase 1] Limes access guard + participant.onPrepareTransition()
      → [Phase 2] session.activeRealmId = realmId
                  session.login(identityId, realmId, activeSurrogate)
                    → scopedUsers[realmId][identityId] = { … }    // upsert
                    → scopedUsers[realmId].__activeId__ = identityId  // pivot
                    → scopedUsers["global"][identityId] = { … }   // global anchor
                    → broadcasts SESSION_CHANGED_TOPIC (OSGi)
      → [Phase 3] OSGi bundle surge (install/purge bundles per realm hierarchy)
```

**Auto-materialization**: when a being arrives `naked` (no active surrogateId), the realm-manager checks
`manifest.recognizedSurrogates` against the being's `surrogates` bag and auto-activates a matching surrogate
([realm-manager L852–L865](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L852-L865)).

---

## 4. The Full Reactivity Chain

```
session.login()
  → SESSION_CHANGED_TOPIC (OSGi EventAdmin)
    → stratum-core EventHandler → triggerUpdate()
        → microtask: _refreshInhabitants() + _broadcastChanged()
          → STRATUM_CHANGED_TOPIC (OSGi)
            → stratographer EventHandler
                → store._grounding = perceiver.observerMode
                → store.refreshTopology()
                → DOM CustomEvent 'stratum-changed'
                  → stratographer dashboard syncUI()
    → session-service-dom bridge
        → DOM CustomEvent 'session-changed'
          → perceiver-service setContext({ being, surrogate })
              → surrogate.grounding → observerMode (SDN-0205)
              → PERCEIVER_CHANGED_TOPIC (OSGi)
                → stratographer EventHandler (same as above)
```

`REALM_CHANGED_TOPIC` and `PERSISTENCE_CONTEXT_CHANGED_TOPIC` also both trigger `stratum-core.triggerUpdate()`.

---

## 5. The Two Perspectives

`perspective` lives on `StratumServiceImpl` ([stratum-core L26](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L26)) — default `"idealist"`.

It is set in two ways:
1. **URI parsing in `jump()`** ([stratum-core L158–L166](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L158-L166)):
   - URI path starts with a realm segment → `realist`
   - URI path starts with an identity segment → `idealist`
2. **`session.shiftGrounding()`** triggered by the stratographer UI toggle → flows through `perceiver-service.setContext()` → `observerMode`

The **perceiver-service** is the canonical holder of `observerMode` ([perceiver-service L28, L200–L202](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L200-L202)):
```js
if (patch.surrogate && patch.surrogate.grounding) {
    patch.observerMode = patch.surrogate.grounding;  // SDN-0205
}
```

### How `refreshTopology()` diverges — [stratographer L183–L241](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js#L183-L241)

| | **Idealist** | **Realist** |
|---|---|---|
| **Trigger branch** | `else` | `if (observerMode === 'realist')` |
| **Graph shape** | 4 fixed nodes | Full hierarchy + all inhabitants as individual nodes |
| **Data sources** | `stratum.tenantId`, `perceiver.being.id`, `perceiver.realm`, `stratum.tier` | `stratum.getHierarchy()` + `stratum.getInhabitants()` + `stratum.residents` |
| **Inhabitants shown** | None | All: forensic ∪ session residents ∪ current being |
| **Realm nodes** | Single `realm` node | Full ancestry chain (Bedrock → Soil → …) |
| **Identity coloring** | Single green node (`#10b981`) | Green for active being, cyan (`#22d3ee`) for each resident |
| **Links** | `tenant → identity → realm → tier` | `tenant → realm[0] → … → realm[n] → identity:each`, `active identity → tier` |
| **`toURI()` format** | `np://tenant/identity/realm/flow?tier=…` | `np://tenant/realm/identity/flow?tier=…` |

**Conceptual summary:**
- **Idealist** = subjective — the world as experienced by the current being
- **Realist** = institutional — the world as it structurally is, regardless of who is observing

### Enriched Senses by Mode — [perceiver-service L163–L169](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L163-L169)

| Mode | Senses injected |
|------|----------------|
| Idealist | `IdealistVision` |
| Realist | `IdealistVision`, `ForensicVision`, `ArchitectControl` |

---

## 6. Grounding Toggle: Full Signal Path

```
UI toggle → store.grounding = "realist"
  → session.shiftGrounding("realist")          [session-service L346]
    → builds surrogate { grounding: "realist", senses: [] }
    → session.login(user.id, scope, surrogate)
      → SESSION_CHANGED_TOPIC
        → session-service-dom → DOM 'session-changed'
          → perceiver-service.setContext({ being, surrogate })
            → observerMode = "realist"
            → PERCEIVER_CHANGED_TOPIC
              → stratographer EventHandler
                → store._grounding = "realist"
                → store.refreshTopology()  ← enters realist branch
```

---

## 7. Key Files Quick Reference

| File | Role |
|------|------|
| [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) | `scopedUsers` owner, `login()`, `shiftGrounding()`, `currentUser` getter |
| [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) | `residents`, `getInhabitants()`, `perspective`, `toURI()`, `jump()`, `triggerUpdate()` |
| [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js) | `coordinateTransition()`, `_switchRealm()`, auto-materialization, bundle surge |
| [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js) | `observerMode` canonical owner, `setContext()`, senses enrichment |
| [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js) | `refreshTopology()` perspective branch, D3 graph, `store.grounding` setter |

---

## 8. Open Investigation: Stale Node Coloring (Optional)

In the realist graph, `inhabitantIds.forEach` at [stratographer L212–L224](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js#L212-L224) determines "Active" vs "Resident" by comparing `identId === beingId`, where `beingId = perceiver.being?.id`.

**Suspected vector**: if the perceiver's `being` is stale after a scope switch (perceiver hasn't yet received the new `session-changed` DOM event), a previous active resident could remain incorrectly coloured green. This may need a `realmId` guard or a timing fix to ensure the perceiver is fully settled before `refreshTopology()` reads `perceiver.being.id`.

_Status: not yet investigated — flagged as optional follow-up._

---

## 9. Related ADRs

- [ADR-0033](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0033-agentic-inhabitation-and-institutional-oversight.md) — Agentic Inhabitation & Institutional Oversight
- [ADR-0165](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0165-sovereign-identity-scoping.md) — Sovereign Identity Scoping (hierarchical context sharding, scope resolution priority)
- [ADR-0170](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0170-multi-persona-residency.md) — Multi-Persona Residency (registry stack model, non-destructive switching)
- [ADR-0176](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0176-headless-stratum-decoupling.md) — Headless Stratum Decoupling
- [ADR-0177](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0177-cross-identity-persistence-namespaces.md) — Cross-Identity Persistence Namespaces
