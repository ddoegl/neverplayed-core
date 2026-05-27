# Handover Ticket: Fix Spatial Logout Guest Mutation and Missing Lobby Redirect

**From:** Cognitive Architect  
**To:** Development Engineer  
**Status:** PENDING IMPLEMENTATION  

---

## Context

During manual logouts from a spatial realm (like `org.neverplayed.realm.empty`), the observer is not successfully returned to the Platonic Staging Lobby. This behavior differs from the automated homeostatic attention decay timer, which successfully transitions the user back to the lobby.

A forensic investigation of `public/bundles/org.neverplayed.session-service/activator.js` revealed two root causes:
1. **The Guest Mutation Bug:** In `session.logout()`, `stack.__activeId__` is mutated to `'guest'` *before* resolving the target user ID for the fallback signal. This causes the code to resolve the user as `'guest'`, bypassing the active surrogate stripping and setting `_pendingLobbyFallback` to `null`.
2. **Missing Active Realm Redirect:** In manual `logout()`, the system updates the stack variables but never triggers a transition back to the Platonic Lobby via `RealmManager.switchRealm('platonic')`, leaving the observer stranded as a guest in the spatial coordinates.

This ticket details the objectives to resolve both issues and restore unified logout fallbacks.

---

## Objectives

### 1. session-service: Resolve targeted User ID before Stack Mutations in `logout()`
- **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- **Target:** Inside the `logout(scope = null, userId = null)` method.
- **Refactoring:**
  - Retrieve the target scope stack: `const stack = this.scopedUsers[targetScope];`
  - Resolve the user ID being logged out **before** mutating any stack values:
    ```javascript
    const resolvedUserId = userId || stack?.__activeId__;
    ```
  - Mutate the stack using `resolvedUserId`:
    ```javascript
    if (stack) {
        if (resolvedUserId && resolvedUserId !== 'guest' && stack[resolvedUserId]) {
            stack[resolvedUserId].loggedIn = false;
        }
        if (stack.__activeId__ === resolvedUserId) {
            stack.__activeId__ = 'guest';
        }
    }
    ```

### 2. session-service: Trigger Active Realm Reversion in `logout()`
- **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- **Target:** Inside the `logout(scope = null, userId = null)` method, inside the `if (targetScope !== 'platonic')` block.
- **Logic:**
  - Strip the surrogate and assign `_pendingLobbyFallback` using `resolvedUserId` instead of the mutated `__activeId__`.
  - Add a check to detect if we are logging out of the currently active spatial realm:
    ```javascript
    if (targetScope === this.activeRealmId) {
        this.activeRealmId = 'platonic';
        logger?.info(`Session: Reverted active realm to 'platonic' for user '${resolvedUserId}'.`);
        if (this._realm && typeof this._realm.switchRealm === 'function') {
            this._realm.switchRealm('platonic').catch(err => {
                logger?.error(`Session: Failed transitioning RealmManager back to platonic:`, err);
            });
        }
    }
    ```
  - This ensures that a manual logout immediately routes the observer back to the Platonic Staging Lobby, keeping it perfectly in sync with the TAME homeostatic attention loop.

### 3. Verification & Tests
- **File:** [platonic-lobby.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/platonic-lobby.test.ts)
- **Objectives:**
  - Run all integration tests via Deno test runner:
    ```bash
    deno test -A tests/run-all.ts
    ```
  - Assert that manual spatial logout results in:
    1. `_pendingLobbyFallback` correctly storing Daniel's/user's authenticated ID (proving the guest mutation is resolved).
    2. `session.activeRealmId` reverting back to `'platonic'`.
    3. `RealmManager` successfully transitioning back to the Platonic Lobby.

---

## Relevant Files

- [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- [platonic-lobby.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/platonic-lobby.test.ts)
