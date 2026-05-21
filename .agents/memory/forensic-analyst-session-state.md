# Forensic Analyst — Session State
_Last updated: 2026-05-21T08:16:00+02:00_

## Current Goal
User is stepping away. Open ticket `ticket-20260521-0807-switchrealm-perceiver-desync.md` needs
design decision before implementation (see Pending Items). Resume discussion on next restore.

## Completed Items
- [x] Read and internalized role rules: `agent-forensic-analyst.md` (read-only, no code changes)
- [x] Reviewed the prior dev engineer merge (conversation: `aabe3efd`) and confirmed it resolved the initial `stratum-decoupling` and `remediate-audit` tickets
- [x] Investigated user-reported navigation sequence (data reset → habitat/rob → governance/rob → habitat/rob → habitat/july → governance/july → switch to realist) reproducing the "missing second resident" and "stale graph" symptoms
- [x] Traced `getInhabitants()` in `org.neverplayed.stratum-core/activator.js` (L92–L109): confirmed it iterates over scope-level stack dictionaries as if they were user objects (`u.id` always undefined → no resident ever added)
- [x] Confirmed cross-scope leakage: after fix, the naive approach scans *all* scopes in `scopedUsers`, not just the active realm scope, causing habitat residents to bleed into core view
- [x] Identified realist mode stale-graph issue: `_syncInhabitants()` in `stratographer/activator.js` merges `forensic` (from `getInhabitants()`) and `local` (from `stratum.residents`) without scope-filtering, causing old realm inhabitants to remain visible in the D3 graph after scope switch
- [x] Investigated `shiftGrounding` / scopedUsers push mechanism in `session-service/activator.js` — confirmed the `__activeId__` key within stacks is the correct pivot point for determining the active user per scope
- [x] Wrote three handover tickets (all now closed and moved to `.agents/handovers/closed/`):
  - `ticket-20260520-1916-residency-drift.md` — Fixed the `getInhabitants()` iteration bug
  - `ticket-20260520-1951-scope-isolated-inhabitants.md` — Scope-isolated inhabitants to the active realm only
  - `ticket-20260520-2053-minor-cleanup.md` — Magic strings & README ADR-0023 link
- [x] Established `closed/` subdirectory convention in `.agents/handovers/` for implemented tickets
- [x] Documented full inhabitation architecture in `.agents/memory/inhabitation-architecture.md`
- [x] Investigated user-reported symptom: July appearing as resident in governance after habitat rob→july→governance switch sequence
- [x] Confirmed `switchRealm` path does NOT call `session.login`, does NOT fire `SESSION_CHANGED_TOPIC`, and does NOT create a `scopedUsers` entry for the new realm
- [x] Confirmed `perceiver.being` stays stale after `switchRealm` because the `session-changed` DOM event is never fired
- [x] Confirmed `being-service` (habitat-exclusive bundle) calls `registerIdentities()` which populates ALL persons into `scopedUsers["org.neverplayed.realm.habitat"]` — this is why July (and all others) exist in the habitat stack without explicit logins
- [x] Wrote handover ticket: `ticket-20260521-0807-switchrealm-perceiver-desync.md`

## Pending Items
- [ ] Dev engineer must implement `ticket-20260521-0807-switchrealm-perceiver-desync.md` (two objectives: perceiver re-sync + governance scope creation on `switchRealm`)
- [ ] Once implemented: run verification sequence (data reset → habitat/rob → switch july → switch rob → switchTo governance → verify only rob appears in realist graph)
- [ ] Optional: confirm whether the D3 node coloring stale "Active" issue (stratographer L212–L224) is fully resolved by Objective 1 of the new ticket or still needs a separate `realmId` guard

## Key Decisions & Context

### scopedUsers Data Shape
```
scopedUsers = {
  "global":                         { __activeId__: "uid1", "uid1": { id, email, … } },
  "org.neverplayed.realm.habitat":  { __activeId__: "rob",  "rob": { id, … }, "july": { id, … } },
  "org.neverplayed.realm.governance": { __activeId__: "rob",  "rob": { id, … } }
}
```
The outer keys are scope IDs (realm IDs); inner keys are identity IDs plus `__activeId__`.

### Root Cause Summary
`getInhabitants()` called `Object.values(scopedUsers)` → got stack *objects* (not user objects) → `u.id` was always `undefined` → no inhabitants returned → stratographer showed empty or stale residents.

### Reactivity Chain
`RealmManager` → `session.login()` → `SESSION_CHANGED_TOPIC` (OSGi) → `session-service-dom` bridge → `session-changed` DOM event → `perceiver-service` `setContext()` → `PERCEIVER_CHANGED_TOPIC` → `stratum-core` `stratum-changed` DOM event → `stratographer` `_dashboardSyncUI` / `refreshTopology()`

### Key Files
- `org.neverplayed.stratum-core/activator.js` L92–L109 — `getInhabitants()` (primary bug site, now fixed)
- `org.neverplayed.stratographer/activator.js` L441–L446 — `_syncInhabitants()` (secondary leakage site, now fixed)
- `org.neverplayed.session-service/activator.js` L138–L167 — `currentUser` getter & `_findIdentity()`
- `org.neverplayed.perceiver-service/activator.js` — `setContext()`, grounding/observerMode mapping
- `org.neverplayed.session-service-dom/activator.js` — DOM bridge for OSGi → `session-changed`

### Established Conventions
- Closed tickets live in `.agents/handovers/closed/` with `**Status:** ✅ Closed — Implemented <date>` header and all objectives checked `[x]`.

### Two Transition Paths (KEY)
There are two distinct realm-switching paths; they behave very differently:

| Path | Trigger | `session.login`? | `SESSION_CHANGED_TOPIC`? | Creates `scopedUsers` entry? |
|------|---------|-----------------|--------------------------|-----------------------------|
| `coordinateTransition()` | `stratum.jump()` / URI bar | ✅ Yes | ✅ Yes | ✅ Yes |
| `switchRealm()` | Stratographer `switchTo()` button | ❌ No | ❌ No | ❌ No |

`_executeTransitionPhase('ACTIVATION')` in realm-manager L1160–1163 sets `session.activeRealmId`
and fires `REALM_CHANGED_TOPIC`, but never calls `session.login`. `perceiver.being` is only
updated via `session-changed` DOM event, which never fires on `switchRealm`.

### Why All Persons Appear in Habitat
`being-service` is the bundle exclusively loaded by the **habitat** realm (`habitat.json` L10).
On activation it calls `session.registerIdentities(enrichedBeings)` with every being from
`beings.yaml`, each with `homeRealm: "org.neverplayed.realm.habitat"`. This populates ALL
persons (rob, july, anna, john, …) into `scopedUsers["org.neverplayed.realm.habitat"]` without
explicit logins.

### Phantom Residents: The Desync Mechanism
When user switches rob→july in habitat, `perceiver.being = july`.
When user switches to governance via `switchTo()` button:
1. `session.activeRealmId = governance` (set in ACTIVATION phase)
2. No `scopedUsers["governance"]` entry created (no `session.login` called)
3. `currentUser` falls back to carry-over: finds rob from habitat stack (`isCarried: true`)
4. `perceiver.being` remains stale (still points to july, or whichever was last `session-changed`)
5. `refreshTopology()` assembles: `inhabitantIds = {perceiver.being.id} ∪ {currentUser.id}` → two phantom nodes

### Open Design Question (discuss on restore)
The ticket proposes two approaches for Objective 1:
- **Preferred:** Extend `REALM_CHANGED_TOPIC` handler in `perceiver-service` to re-read
  `session.currentUser` after a realm switch. Targeted, no side-effects.
- **Alternative:** Emit synthetic `SESSION_CHANGED_TOPIC` from `realm-manager` ACTIVATION phase.
  Heavier but catches all downstream consumers automatically.

Objective 2 (call `session.login` on `switchRealm`) would subsume Objective 1 if implemented,
but both approaches in Obj 1 remain useful as belt-and-suspenders guards.

User wants to think about the right approach before greenlit for implementation.
