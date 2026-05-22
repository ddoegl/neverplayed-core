# Handover Ticket: `switchRealm` Does Not Sync Perceiver — Phantom Residents in Stratographer

- **From:** Forensic Analyst (Antigravity)
- **To:** Development Engineer
- **Date:** 2026-05-22
- **Status:** ✅ Closed — Implemented & Verified 2026-05-22

---

## 📋 Context & Root Cause

Forensic investigation of the user-reported symptom: after switching from `habitat/rob` to `governance` via the Stratographer realm switcher, `july` appears as a resident node in the governance D3 graph despite `july` having never been logged into `governance`.

There are two distinct transition paths in the system:

| Path | Trigger | Calls `session.login`? | Fires `SESSION_CHANGED_TOPIC`? | Updates `perceiver.being`? |
|------|---------|----------------------|-------------------------------|---------------------------|
| `coordinateTransition()` | `stratum.jump()` (URI bar) | ✅ Yes | ✅ Yes | ✅ Yes |
| `switchRealm()` / `_switchRealm()` | Stratographer `switchTo()` button | ❌ No | ❌ No | ❌ No |

`_executeTransitionPhase('ACTIVATION')` in [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js) sets `session.activeRealmId` and fires `REALM_CHANGED_TOPIC` but **never calls `session.login`**.

The `perceiver-service` updates `perceiver.realm` in response to `REALM_CHANGED_TOPIC`, but `perceiver.being` is only updated via the `session-changed` DOM event, which is only fired when `SESSION_CHANGED_TOPIC` fires (which `switchRealm` never triggers).

### Consequence in `refreshTopology()`

The realist topology is assembled from two independent sources that diverge after a `switchRealm`:

```js
inhabitantIdsSet = new Set([
    ...forensic,          // from getInhabitants() → uses currentUser (carry-over = rob)
    ...local,             // from stratum.residents → [] (no governance scope exists)
    beingId               // from perceiver.being?.id ← STALE (still holds last session-changed user)
]);
```

If the user last triggered a `session-changed` event with identity X (e.g. July), `perceiver.being` remains July after switching realm. Meanwhile `currentUser` (carry-over from habitat) is Rob.

The two IDs end up in `inhabitantIds` simultaneously. The stratographer then labels:
- `perceiver.being.id` (July) → `label: "Active"` (green node)
- `currentUser.id` (Rob) → `label: "Resident"` (cyan node)

...in the wrong realm, producing phantom inhabitants that have never touched governance.

### Architectural Alignment: Carry-over vs. Forced Residency

`switchRealm()` not invoking `session.login()` is **by design**. Under the [Inhabitation Architecture](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/inhabitation-architecture.md), a user who switches realms directly is considered "visiting" (carried-over with `isCarried: true`) rather than "residing".

Populating a local resident stack immediately upon a simple switch would create an incorrect residency side-effect (making them a resident of every realm they browse). It is only when the user shifts their grounding (perspective) or performs an action in the new realm that `session.login()` should be explicitly side-effected.

Therefore, **we must not force `session.login` during `switchRealm`**. We must only ensure the Perceiver Service is updated to reflect the new active carried-over being context.

---

## 🎯 Objectives

### 1. Store Session Reference in Perceiver Service Tracker
Update the Perceiver Service to preserve a reference to the tracked session:
- [x] In [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js):
  - [x] In `SESSION_SERVICE` tracker's `addingService`, assign the tracked session to `this._session`.
  - [x] Add `removedService: () => { this._session = null; }` to release the reference.

### 2. Implement Lighter Sync in `perceiver-service`
Update the `REALM_CHANGED_TOPIC` event handler to sync perception context from the active session:
- [x] In [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js):
  - [x] In the event handler for `REALM_CHANGED_TOPIC`, trigger `this._syncFromSession(this._session)` if `this._session` is active.
- [x] **Crucial**: Do **NOT** add `session.login` side-effects to `switchRealm()`. Carry-over state must be preserved without generating residency records in local storage.

### 3. Add Automated Integration Test
Verify that switching realms updates the perceiver's active being context without creating a local resident footprint:
- [x] Create or update a test (implemented in [tests/perceiver-carryover-sync.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/perceiver-carryover-sync.test.ts)) using the `BundleTestHarness` that:
  - [x] Mocks `PersistenceManager`.
  - [x] Installs: `system-logger`, `alpine-bridge`, `session-service`, `realm-manager`, `perceiver-service`.
  - [x] Logs in `rob` to `realm.habitat`.
  - [x] Executes `realmManager.switchRealm("governance")`.
  - [x] Asserts `perceiver.getRealm() === "governance"`.
  - [x] Asserts `perceiver.getBeing().id === "rob"` (reflecting carry-over).
  - [x] Asserts that the persistence manager load for `scopedUsers` contains **no** entry for `"org.neverplayed.realm.governance"`.

---

## 📂 Relevant Files

- 📄 [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js) — Primary fix site
- 📄 [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js) — Where phantom inhabitants surface
- 📄 [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) — Carry-over state source
- 📄 [Inhabitation Architecture Memory Document](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/inhabitation-architecture.md)

---

## 🔍 Verification

### Automated Tests
- Run the Deno test suite:
  ```bash
  deno test -A tests/run-all.ts
  ```
- **Results:** Integrated `tests/perceiver-carryover-sync.test.ts` into the global suite and verified that 9/9 regression tests pass successfully.

### Manual Verification
Perform the following sequence to verify visually:
1. Execute a data reset.
2. Jump to `realist habitat:rob` via the URI bar (`np://tenant/org.neverplayed.realm.habitat/rob/…`).
3. Switch to `july` in the habitat realm via UI.
4. Switch back to `rob` in the habitat realm.
5. Switch to the `governance` realm via the Stratographer realm selector button.
6. Open the Stratographer dashboard.

**Expected Results:**
- Only `rob` (the carry-over user) is rendered as a node in the governance graph.
- `july` is completely absent from the governance graph.
- Verify `scopedUsers` in local storage has **no** `"org.neverplayed.realm.governance"` entry (retaining the visiting carry-over state).
