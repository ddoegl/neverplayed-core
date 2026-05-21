# Handover Ticket: `switchRealm` Does Not Sync Perceiver — Phantom Residents in Stratographer

- **From:** Forensic Analyst
- **To:** Development Engineer
- **Status:** 🔴 Open — Awaiting Implementation
- **Context:** Forensic investigation of the user-reported symptom: after switching from habitat/rob
  to governance via the Stratographer realm switcher, July appears as a resident node in the
  governance D3 graph despite July having never been logged into governance.

---

## Root Cause

There are two distinct transition paths in the system:

| Path | Trigger | Calls `session.login`? | Fires `SESSION_CHANGED_TOPIC`? | Updates `perceiver.being`? |
|------|---------|----------------------|-------------------------------|---------------------------|
| `coordinateTransition()` | `stratum.jump()` (URI bar) | ✅ Yes | ✅ Yes | ✅ Yes |
| `switchRealm()` / `_switchRealm()` | Stratographer `switchTo()` button | ❌ No | ❌ No | ❌ No |

`_executeTransitionPhase('ACTIVATION')` in [realm-manager/activator.js L1160–L1163](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L1160-L1163) sets
`session.activeRealmId` and fires `REALM_CHANGED_TOPIC`, but **never calls `session.login`**.

`perceiver-service` updates `perceiver.realm` in response to `REALM_CHANGED_TOPIC` ([perceiver-service L105–L112](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L105-L112)),
but **`perceiver.being` is only updated via the `session-changed` DOM event**, which is only
fired when `SESSION_CHANGED_TOPIC` fires — which `switchRealm` never triggers.

### Consequence in `refreshTopology()` — [stratographer L183–L224](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js#L183-L224)

The realist topology is assembled from two independent sources that diverge after a `switchRealm`:

```
inhabitantIdsSet = new Set([
    ...forensic,          // from getInhabitants() → uses currentUser (carry-over = rob)
    ...local,             // from stratum.residents → [] (no governance scope exists)
    beingId               // from perceiver.being?.id ← STALE (still holds last session-changed user)
]);
```

If the user last triggered a `session-changed` event with identity X (e.g. July), `perceiver.being`
remains July after switching realm. Meanwhile `currentUser` (carry-over from habitat) is Rob.

The two IDs end up in `inhabitantIds` simultaneously. The stratographer then labels:
- `perceiver.being.id` (July) → `label: "Active"` (green node)
- `currentUser.id` (Rob) → `label: "Resident"` (cyan node)

...in the wrong realm, producing phantom inhabitants that have never touched governance.

### Secondary consequence: no governance scope in `scopedUsers`

Because `switchRealm` never calls `session.login(identityId, realmId)`, no
`scopedUsers["org.neverplayed.realm.governance"]` stack is ever created. `currentUser`
falls back to the "Being Carry-over" path, finding the last active being from any scope.
This means all realm-scoped residency data for governance exists **only in memory** and is
never grounded in a proper scope stack.

---

## Objectives

### 1. Sync the Perceiver after `switchRealm`

After `session.activeRealmId` is set in `_executeTransitionPhase('ACTIVATION')`, the
system must re-sync `perceiver.being` with the session's current identity for the new realm.

**Recommended approach — emit `SESSION_CHANGED_TOPIC` from the ACTIVATION phase**:

In [realm-manager/activator.js `_executeTransitionPhase` around L1162](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L1160-L1164),
after setting `session.activeRealmId`, broadcast a synthetic `SESSION_CHANGED_TOPIC` so the
DOM bridge and perceiver can re-synchronize:

```js
this._activeRealmId = pt.id;
if (this.session) {
    this.session.activeRealmId = pt.id;
    // Sync perceivers: emit a session-changed event so perceiver.being reflects
    // the carry-over identity in the new realm context.
    if (this._eventAdmin && this._eventFactory) {
        const evt = this._eventFactory.build(SESSION_CHANGED_TOPIC, {
            type: 'realm-switch',
            user: this.session.currentUser,
            scope: pt.id
        });
        this._eventAdmin.postEvent(evt);
    }
}
```

> **Note:** `session-service-dom` will translate this OSGi event into a DOM `session-changed`
> event, causing `perceiver-service` to call `setContext({ being: currentUser })` with the
> post-switch carry-over identity. This closes the desync gap without requiring a full login.

**Alternative (lighter) approach**: Add a `REALM_CHANGED_TOPIC` handler to `perceiver-service`
that re-reads `session.currentUser` directly and calls `setContext({ being: currentUser })`:

```js
// In perceiver-service, extend the existing REALM_CHANGED_TOPIC handler:
handleEvent: (event) => {
    const realmId = event.getProperty("realm.id");
    if (realmId) {
        this.setContext({ realm: realmId });
        // Re-sync being from current session state
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        if (sessionRef) {
            const session = context.getService(sessionRef);
            this._syncFromSession(session);  // already exists on perceiver
        }
    }
}
```

The alternative is preferable as it keeps the fix inside the perceiver and avoids emitting
synthetic session events from the realm manager.

### 2. Create a governance scope on `switchRealm`

When `_switchRealm` activates a new realm, `session.login(currentUser.id, realmId)` should
be called so a proper scope stack is created — mirroring what `coordinateTransition` does in
Phase 2. This ensures `stratum.residents` is accurate and `scopedUsers` has a governance
entry after a realm switch.

In [realm-manager/activator.js `_executeTransitionPhase` around L1162](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L1160-L1164):

```js
this._activeRealmId = pt.id;
if (this.session) {
    this.session.activeRealmId = pt.id;
    // Establish a resident scope for the new realm using the carry-over being
    const currentUserId = this.session.currentUser?.id;
    if (currentUserId && currentUserId !== 'guest') {
        await this.session.login(currentUserId, pt.id);
    }
}
```

> **Note:** This subsumes Objective 1 if `session.login` is called, since it fires
> `SESSION_CHANGED_TOPIC` automatically. However Objective 1's lighter fix in the perceiver
> is still preferable as a belt-and-suspenders guard against any future quiet transitions.

---

## Evidence from Live State

From the inspected `scopedUsers` state object:

- `activeRealmId: "org.neverplayed.realm.governance"` ✅ set by `_executeTransitionPhase`
- `scopedUsers` has **no** `"org.neverplayed.realm.governance"` key ← confirms no `session.login` was called
- `currentUser.isCarried: true, carriedFrom: "org.neverplayed.realm.habitat"` ← carry-over path active
- July and all other beings present in `scopedUsers["org.neverplayed.realm.habitat"]` ← populated by `being-service` `registerIdentities()` which runs when habitat's bundle (`org.neverplayed.being-service`) is loaded

---

## Relevant Files

- [realm-manager/activator.js L1101–L1210](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js#L1101-L1210) — `_executeTransitionPhase('ACTIVATION')` — **primary fix site**
- [perceiver-service/activator.js L104–L112](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L104-L112) — `REALM_CHANGED_TOPIC` handler — **alternative fix site**
- [perceiver-service/activator.js L174–L192](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js#L174-L192) — `_syncFromSession()` — ready to be called post-switch
- [stratographer/activator.js L168–L241](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js#L168-L241) — `refreshTopology()` — where phantom inhabitants surface
- [session-service/activator.js L223–L303](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js#L223-L303) — `login()` — creates the scope stack entry
- [session-service-dom/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service-dom/activator.js) — DOM bridge: translates `SESSION_CHANGED_TOPIC` → `session-changed` DOM event

---

## Verification

After implementing, reproduce the original user sequence:

1. Data reset
2. Jump to `realist habitat:rob` via URI (`np://tenant/org.neverplayed.realm.habitat/rob/…`)
3. Switch to `july` in habitat (via UI or CLI)
4. Switch back to `rob` in habitat
5. Switch to `governance` via the Stratographer realm selector button
6. Open the Stratographer dashboard in realist mode

**Expected:** Only `rob` (or the correct carry-over being) appears in the governance graph.
July must not appear as any node.

**Also verify:** `scopedUsers` in localStorage now has an `"org.neverplayed.realm.governance"` entry after step 5.
