# Handover Ticket: Fix Spatial Logout Guest Mutation and Missing Lobby Redirect

**Ticket ID:** TICKET-20260527-2105-LOGOUT-PATCH  
**From:** Forensic Analyst & Cognitive Architect  
**To:** Development Engineer  
**Status:** COMPLETED ✅  
**Completed At:** 2026-05-27T22:20:00+02:00  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Ontological Context & Problem Statement

Under the **Scale-Free Symmetry of Logout** established in Section 11 of the `ontology.md`, an **L1 Occupant Exit (Active Retreat)** is a homeostatic boundary adjustment where an active L1 Being retreats from concrete spatial coordinates back to the primordial baseline of the **Platonic Staging Lobby** as a default observer.

During manual spatial logouts (e.g. from `org.neverplayed.realm.empty`), the observer is not returned to the lobby, leaving the observer stranded as a guest. The forensic investigation identified two systemic bugs inside `public/bundles/org.neverplayed.session-service/activator.js`:

1.  **The Guest Mutation Bug:** In `session.logout()`, the stack sentinel `__activeId__` is mutated to `'guest'` *before* resolving the target user ID for the fallback signal. As a result, the subsequent fallback block resolves the active user as `'guest'` instead of the actual authentic user (e.g. `daniel`). This bypasses the active surrogate stripping and leaves `_pendingLobbyFallback` as `null`.
2.  **Missing Active Realm Redirect:** While manual `logout()` correctly updates the stack state variables, it fails to trigger the programmatic transition back to the lobby via `RealmManager.switchRealm('platonic')`, leaving the observer stranded in empty spatial coordinate space.

This patch will fix both issues to align the codebase with the scale-free active retreat model.

---

## 2. Technical Objectives

### Objective 1: Capture and Resolve User ID before Stack Mutations in `logout()`
*   **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
*   **Target:** `logout(scope = null, userId = null)` method.
*   **Refactoring:**
    *   Retrieve the target scope stack: `const stack = this.scopedUsers[targetScope];`
    *   Resolve the target user ID **before** mutating any stack values:
        ```javascript
        const resolvedUserId = userId || stack?.__activeId__;
        ```
    *   Perform the login state mutations using `resolvedUserId` instead of `__activeId__`:
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

### Objective 2: Cleanly Strip Surrogate & Trigger Active Realm Reversion to `platonic`
*   **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
*   **Target:** `logout()`'s lobby fallback block (`if (targetScope !== 'platonic')`).
*   **Refactoring:**
    *   Use `resolvedUserId` to identify the occupant whose surrogate needs to be stripped.
    *   If the logged-out scope is the currently active spatial realm (`this.activeRealmId`), update the reactive state and trigger a programmatic switch to the Platonic Lobby via `RealmManager.switchRealm('platonic')`:
        ```javascript
        if (targetScope !== 'platonic') {
            if (resolvedUserId && resolvedUserId !== 'guest' && stack?.[resolvedUserId]) {
                stack[resolvedUserId].activeSurrogateId = null;
            }
            logger?.info(`Session: Realm exit from '${targetScope}'. Being '${resolvedUserId}' falls back to platonic lobby.`);
            this._pendingLobbyFallback = (resolvedUserId && resolvedUserId !== 'guest') ? resolvedUserId : null;
            
            // Revert active spatial realm scope to Platonic Staging Lobby
            if (targetScope === this.activeRealmId) {
                this.activeRealmId = 'platonic';
                logger?.info(`Session: Reverted active realm to 'platonic' for user '${resolvedUserId}'.`);
                if (this._realm && typeof this._realm.switchRealm === 'function') {
                    this._realm.switchRealm('platonic').catch(err => {
                        logger?.error(`Session: Failed transitioning RealmManager back to platonic:`, err);
                    });
                }
            }
        }
        ```

---

## 3. Verification & Compliance Plan

To verify this patch, run the existing integration tests using the Deno test runner:

```bash
deno test -A tests/run-all.ts
```

### Key Assertions in [platonic-lobby.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/platonic-lobby.test.ts):
1.  **Surrogate Stripping:** Verify that the realm-specific active surrogate is cleanly stripped (`activeSurrogateId === null`) on the exiting user record in the target spatial stack.
2.  **Lobby Fallback Signal:** Assert that `session._pendingLobbyFallback` correctly stores the authenticated being's ID (proving that the guest mutation bug has been resolved).
3.  **Active Realm Pivot:** Assert that `session.activeRealmId` successfully reverts to `'platonic'`.
4.  **UI Coordination:** Assert that `RealmManager` successfully coordinates the transition back to the Platonic Staging Lobby.

---

## 4. Architectural Constraints

*   **Do not alter state directly in other bundles:** The transition must go through `session.logout()` to preserve the OSGi reactive event cycle.
*   **Do not modify the Platonic Staging Lobby stack (`scopedUsers['platonic']`):** The Staging Lobby represents the observer's primordial morphospace and must remain un-mutated.
