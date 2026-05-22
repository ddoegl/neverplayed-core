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

These are different and computed differently in the code:

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

### Technical Implementation vs. Ontological Ideal

There is a subtle semantic shift between the current codebase implementation and the ecological/fantasy worldbuilding ideals of inhabitation:

| Term | Current Technical Implementation | Ecological / Fantasy Ideal (Ontology) |
|---|---|---|
| **Resident** | **Volatile Session Occupant**:<br>Determined by a live `scopedUsers[realmId]` session stack entry. Cleared upon session logout or data reset. | **Native / Denizen (Roots)**:<br>A being permanently anchored to their realm of origin (e.g. `habitat`), regardless of current session status. |
| **Inhabitant** | **Forensic Trace-Maker**:<br>Determined by the presence of persistent data keys in the Stratum (PM) + active session stack entries. | **Current Physical Occupant (Transient)**:<br>Anyone occupying the realm *right now* (whether a Native at home or a Sojourner/Visitor visiting). |

#### Why does perspective-switching create residency entries?
When switching from `idealist` to `realist` perspective (or vice versa), the Stratographer dashboard calls `session.shiftGrounding()`. 
- To apply the new grounding and its associated senses (e.g. `ForensicVision`), `shiftGrounding` executes an explicit `session.login(userId, targetScope, newSurrogate)` command.
- Because `login()` is called, a local resident entry is created in `scopedUsers[targetScope]` (such as `scopedUsers["org.neverplayed.realm.core"]`).
- Consequently, **perspective switching side-effects local login**, turning a previously carried-over user profile into an explicit local resident of that scope.

#### Why does direct realm-switching not create residency entries?
- When switching realms directly (e.g., to `showcase`), the system executes a direct switch (`_switchRealm`). 
- If the active user profile already has a surrogate (i.e. was materialized during the previous perspective switch), the auto-materialization checks are bypassed, and `session.login()` is *never* called for the target realm.
- Thus, the target stack (`scopedUsers["org.neverplayed.realm.showcase"]`) remains empty, and the system relies entirely on the **Carry-over Mechanism** to resolve the profile from the source realm (yielding `isCarried: true`, `carriedFrom: core`).
- The moment the perspective is shifted in the new realm, `shiftGrounding` is triggered, calling `login()`, which finally creates the local residency entry in the target scope stack.

---

## 3. Being Carry-over & Surrogate Materialization

When a being shifts focus to a target realm or scope, they may not yet have an active login record or residency in that specific scope (i.e., `scopedUsers[realmId]` has no entry or has `__activeId__` set to `"guest"`). Rather than discarding context or forcing a guest experience, the system employs **Carry-over** to inherit the profile from another scope, and **Materialization** to overlay the being's functional role (Surrogate).

---

### When and How a Being is Deemed Carried-Over

A `currentUser` is resolved dynamically via a three-tier pipeline within the `session-service`'s `currentUser` getter ([session-service/activator.js L138–L168](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js#L138-L168)):

1. **Step 1: Local Scope Residency Check**:
   - The current active scope is resolved via `activeFlowId || activeRealmId || "global"`.
   - The stack for that scope is fetched: `stack = scopedUsers[scope]`.
   - If the active ID in that stack (`stack.__activeId__`) is defined and does *not* equal `'guest'`, the local resident's profile is used.
2. **Step 2: Carry-over Resolution**:
   - If no local resident is found, the system checks if a focus being is active: `this.activeBeingId`.
   - If `activeBeingId` is set, it invokes the cross-scope lookup helper `_findIdentity(activeBeingId, scope)`.
   - If `_findIdentity` successfully locates a profile for that being in any other scope, the profile is returned and decorated with the following carry-over attributes:
     - `isCarried: true`
     - `carriedFrom: profile.scope` (the scope where the active profile was found).
3. **Step 3: Global/Guest Fallback**:
   - If no carry-over profile is found, the getter falls back to the `"global"` stack's active resident, and ultimately to a `{ id: 'guest' }` representation.

#### The Cross-Scope Lookup Algorithm (`_findIdentity`)
The lookup helper ([session-service/activator.js L171–L191](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js#L171-L191)) uses a tiered search to ensure the most specific and populated profile is carried over:

```js
_findIdentity(id, preferredScope = null) {
    // 1. Try preferred scope first (Inhabitation/Residency over Carry-over)
    if (preferredScope && this.scopedUsers[preferredScope]?.[id]) {
        return { ...this.scopedUsers[preferredScope][id], scope: preferredScope };
    }

    // 2. Try to find a Materialized version anywhere (Persona Carry-over)
    for (const [scope, stack] of Object.entries(this.scopedUsers)) {
        if (stack[id] && stack[id].activeSurrogateId && stack[id].email) {
            return { ...stack[id], scope };
        }
    }

    // 3. Fallback to any other scope (e.g., Global anchor)
    for (const [scope, stack] of Object.entries(this.scopedUsers)) {
        if (stack[id] && stack[id].email) {
            return { ...stack[id], scope };
        }
    }
    return null;
}
```

- **Persona Carry-over (Priority 2)**: The system prioritizes carrying over profiles that already have a selected surrogate (`activeSurrogateId`) and email. This preserves the being's active role across realms.
- **Anchoring Fallback (Priority 3)**: If no materialized version is found, any scope stack entry containing an email (usually the `"global"` anchor generated at login) is returned.

---

### The Relationship to Materialization

**Materialization** is the process of converting a raw L1 Being identity (holding credentials like `id` and `email`) into a functional L6 Persona/Surrogate role (possessing domain-level permissions, attributes, and senses).

#### The Pipeline Sequence
1. **Lookup Phase**: The `currentUser` getter first identifies the user record (locally, via carry-over, or via global fallback).
2. **Materialization Phase**: The user record is passed to the internal helper `_materialize(identity)` ([session-service/activator.js L194–L212](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js#L194-L212)).
   - If the identity possesses an `activeSurrogateId` and the surrogate profile exists in its `surrogates` bag, the surrogate parameters are merged:
     ```js
     return {
         ...identity,
         ...surrogate,
         id: identity.id, // Primary Being ID (L1) must remain the main identifier
         surrogateId: surrogate.id, // Functional Role ID (L6)
         isMaterialized: true
     };
     ```
   - If no surrogate is active, the raw identity is returned as-is (e.g. `isMaterialized` is undefined/false).

Therefore, a `currentUser` can have the following combination of states:
- **Residing & Materialized**: `isCarried: undefined` (locally logged in), `isMaterialized: true` (active surrogate applied).
- **Carried-Over but Naked**: `isCarried: true` (inherited from another scope), `isMaterialized: undefined/false` (no active surrogate profile).
- **Carried-Over & Materialized**: `isCarried: true` (inherited from another scope), `isMaterialized: true` (surrogate merged).

---

### Interplay with Transitions & Auto-Materialization

When moving between realms, the transition path dictates how carry-over and materialization are resolved:

#### Path A: Coordinate Transition (`_coordinateTransition`)
This is the standard transition flow executed by the transition coordinator when jumping or typing `/realm jump` ([realm-manager/activator.js L722–L742](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L722-L742)):
1. **Pre-Login Sensing**: The coordinator fetches the being's resolved profile using `session.getResolvedIdentity(proposed.identityId)`.
2. **Recognized Surrogate Intersection**: If the user is currently "naked" (`!userProfile.surrogateId`), the coordinator checks if the target realm's manifest `recognizedSurrogates` list intersects with the user's possessed surrogates list.
3. **Explicit Login**: If a recognized surrogate is found, it is selected as the `activeSurrogate` parameter and passed to `session.login(identityId, realmId, activeSurrogate)` ([realm-manager/activator.js L787](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L787)).
4. **Result**: An explicit stack entry is created in `scopedUsers[realmId]`. The user is immediately **Residing & Materialized** in the new realm. Carry-over is bypassed because the user now has a local resident footprint.

#### Path B: Direct Switch (`_switchRealm`)
This flow is executed during programmatic or non-coordinated switches, such as switching from the shell header or stratographer dashboard ([realm-manager/activator.js L852–L865](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L852-L865)):
1. **Pre-switch Sensing**: The coordinator reads the current user: `user = session.currentUser`.
2. **Surrogate Check**: If the user is naked (`!user.surrogateId`), and the target realm's manifest recognizes one of the user's surrogates, it attempts to activate it: `session.activateSurrogate(available, targetRealmId)`.
3. **Residency Dependency**: `session.activateSurrogate` works by updating `scopedUsers[targetScope][activeId]` where `activeId` is the active resident in the target scope.
   - If the user has *never* logged in to the target realm (making the target stack empty or set to `guest`), `activateSurrogate` fails because the user does not exist in that stack yet.
   - In this case, the user's identity is not provisioned locally; it continues to resolve via the **Carry-over Mechanism** (inheriting the profile from the source stack, marked as `isCarried: true`).
   - If the user *does* have a prior login record in the target realm stack, `activateSurrogate` successfully switches their active surrogate, materializing them locally.

---

## 4. How Inhabitation Is Established: The Login Chain

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

## 5. The Full Reactivity Chain

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

## 6. The Two Perspectives

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

## 7. Grounding Toggle: Full Signal Path

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

## 8. The Perception Layer: How Perception Mediates Existence

While the Session and Stratum Core layers define the *objective* state of who has logged in (Residents) or left data (Inhabitants), the **perceiver-service** acts as the cognitive filter (the "Observer"). It determines what of this objective state is actually *perceived* by the current active being under their active surrogate's grounding.

### Conceptual Mapping: Objective vs. Perceived

| Concept | Objective State (Stratum Core / Session) | Perceived State (Perceiver / Plexus) |
| :--- | :--- | :--- |
| **Being** | `session.currentUser` (raw global or realm identity). | `perceiver.being` ([perceiver-service/activator.js L131](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L131)) - the acting observer, subject to observer mode capabilities. |
| **Residents** | `stratum.residents` (raw session stack list). | Only perceived in `realist` mode. Invisible in `idealist` mode ([stratographer/activator.js L183–L241](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js#L183-L241)). |
| **Inhabitants** | `stratum.getInhabitants()` (forensic PM union). | Only perceived in `realist` mode. Dynamically inspected/sensed using stigmergic traces ([plexus-sensor/activator.js L120–L149](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.plexus-sensor/activator.js#L120-L149)). |

---

### Senses & Sensation: Plexus Integration

The Perceiver Service does not work in isolation; it integrates with the **Plexus** ecosystem to translate raw presence into visible or hidden state:

1. **Senses Enrichment**: 
   The service tracks `KNOWLEDGE_PROVIDER_SERVICE` registrations ([perceiver-service/activator.js L88–L101](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L88-L101)). When `getEnrichedSenses()` is invoked, it dynamically queries all registered providers to inject sensory capabilities (e.g., `IdealistVision`, `ForensicVision`, `ArchitectControl`) into the context patch ([perceiver-service/activator.js L137–L153](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L137-L153)).

2. **Stigmergic Perception (`plexus-sensor`)**:
   The `plexus-sensor` bundle evaluates DOM elements and topology nodes annotated with `data-mark` attributes ([plexus-sensor/activator.js L54–L76](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.plexus-sensor/activator.js#L54-L76)). It builds an evaluation context:
   ```js
   const evaluationContext = {
       ...ctx.being,
       surrogate: { ...ctx.surrogate, senses: enrichedSenses },
       realm: ctx.realm
   };
   ```
   If the active being lacks the required senses (e.g. they only have `IdealistVision` but a node requires `ForensicVision`), the element's visibility is revoked (`display: none` and `aria-hidden="true"`), rendering the corresponding inhabitant or resident "non-existent" to the observer ([plexus-sensor/activator.js L106–L112](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.plexus-sensor/activator.js#L106-L112)).

3. **Cognitive Guarding (Limes)**:
   The security layer (`org.neverplayed.limes`) maps permissions dynamically using the Perceiver's context:
   ```js
   const evaluationContext = {
       ...(userCap || perceiverContext.being),
       surrogate: perceiverContext.surrogate,
       realm: perceiverContext.realm,
       ...runtimeContext
   };
   ```
   Access to flows, transitions, and capabilities is determined not by who the user is globally, but by what their current surrogate is capable of *perceiving* and *accessing* within the active realm ([limes/activator.js L190–L195](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.limes/activator.js#L190-L195)).

---

## 9. Key Files Quick Reference

| File | Role |
|------|------|
| [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) | `scopedUsers` owner, `login()`, `shiftGrounding()`, `currentUser` getter |
| [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) | `residents`, `getInhabitants()`, `perspective`, `toURI()`, `jump()`, `triggerUpdate()` |
| [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js) | `coordinateTransition()`, `_switchRealm()`, auto-materialization, bundle surge |
| [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js) | `observerMode` canonical owner, `setContext()`, senses enrichment |
| [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js) | `refreshTopology()` perspective branch, D3 graph, `store.grounding` setter |

---

## 10. Open Investigation: Stale Node Coloring (Optional)

In the realist graph, `inhabitantIds.forEach` at [stratographer L212–L224](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js#L212-L224) determines "Active" vs "Resident" by comparing `identId === beingId`, where `beingId = perceiver.being?.id`.

**Suspected vector**: if the perceiver's `being` is stale after a scope switch (perceiver hasn't yet received the new `session-changed` DOM event), a previous active resident could remain incorrectly coloured green. This may need a `realmId` guard or a timing fix to ensure the perceiver is fully settled before `refreshTopology()` reads `perceiver.being.id`.

_Status: not yet investigated — flagged as optional follow-up._

---

## 11. Related ADRs

- [ADR-0033](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0033-agentic-inhabitation-and-institutional-oversight.md) — Agentic Inhabitation & Institutional Oversight
- [ADR-0165](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0165-sovereign-identity-scoping.md) — Sovereign Identity Scoping (hierarchical context sharding, scope resolution priority)
- [ADR-0170](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0170-multi-persona-residency.md) — Multi-Persona Residency (registry stack model, non-destructive switching)
- [ADR-0176](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0176-headless-stratum-decoupling.md) — Headless Stratum Decoupling
- [ADR-0177](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0177-cross-identity-persistence-namespaces.md) — Cross-Identity Persistence Namespaces
