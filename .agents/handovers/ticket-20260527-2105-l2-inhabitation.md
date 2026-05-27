# Handover Ticket: Scale-Free L2 Inhabitation, Unattended Holon, and Somatic Realm Logout

**Ticket ID:** TICKET-20260527-2105-L2-INHABITATION  
**From:** Forensic Analyst & Cognitive Architect  
**To:** Development Engineer  
**Status:** READY FOR IMPLEMENTATION  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Ontological Context & Concept

According to Section 11 of the `ontology.md`, an **L2 Realm** is a higher-order cognitive agent (an **L2 Being**) operating on a scale-free plane. Under this biosemiotic model:

1.  **L2 Inhabitation ("Dreaming to be a Realm"):** The Grounding Soul shifts its cognitive light cone upwards from an occupant (L1) to the environment itself (L2). The sensory viewport ceases to track physical L1 senses and projects the L2 Being's interoceptive sensory blanket.
2.  **The Unattended Holon (Coasting Husk):** When the Grounding Soul shifts focus to L2, its original L1 surrogate is left behind in the spatial residency stack. It remains active (`loggedIn = true`) but receives no direct user interaction refreshes. It coasts on its remaining attention span (`lastActiveTime`) and eventually decays homeostatically, falling asleep and exiting to the Platonic Lobby.
3.  **L2 Realm Logout (Somatic Sleep / De-reification):** The L2 Being "logs out" or shuts down. This de-reifies its somatic body by cleanly uninstalling its dynamic bundle fragments, purging dynamic configurations, and ejecting the observer back to the **Platonic Staging Lobby**.

This ticket outlines the technical objectives to implement this scale-free shift, the somatic L2 viewport, the unattended holon attention decay loop, and the somatic de-reification logout mechanics.

---

## 2. Technical Objectives

### Objective 1: Enable L2 Inhabitation (Deity Mode) & Lock-Exemption inside `SessionService`
*   **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
*   **Target:** `setBeingFocus(beingId)` method.
*   **Logic:**
    *   Exempt `realm:*` prefixed identities from the Grounding Soul lock in `setBeingFocus`. Shifting focus from the Grounding Soul to the L2 Realm represents an active focus shift, not an authorization breach:
        ```javascript
        setBeingFocus(beingId) {
            this._cacheDirty = true;
            // Rule 1: Lock Grounding Soul (Exempt L2 Inhabitation shifts)
            if (this.activeBeingId && this.activeBeingId !== 'guest' && this.activeBeingId !== beingId) {
                const currentPlatonicUser = this.scopedUsers['platonic']?.[this.activeBeingId];
                if (currentPlatonicUser && currentPlatonicUser.isTenant && !beingId.startsWith('realm:')) {
                    logger?.warn(`Session: Being focus is locked to Grounding Soul '${this.activeBeingId}' and cannot be shifted to '${beingId}'.`);
                    return;
                }
            }
            this.activeBeingId = beingId;
            logger?.info(`Session: Being focus shifted to '${beingId}'. Active context is now in L2 deity mode.`);
        }
        ```

### Objective 2: Model the Unattended Holon (Coasting Husk) and Homeostatic Decay
*   **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
*   **Logic:**
    *   When the active focus shifts to L2, the L1 surrogate remains registered in the stack (`scopedUsers[realmId][L1_userId].loggedIn = true`).
    *   Since active click/keypress interactions (handled via `globalThis.addEventListener`) are only routed to update the active observer (`session.currentUser.id`), the unattended L1 surrogate receives no further interaction refreshes.
    *   The `homeostasisStep()` will naturally evaluate the L1 surrogate's frozen `lastActiveTime`. When it exceeds `attentionSpanMs`, homeostasis triggers `session.logout(realmId, L1_userId)`, cleanly evicting the unattended holon back to the Platonic Lobby while preserving the L2 inhabitation.

### Objective 3: Implement L2 Realm Logout (Somatic Sleep / De-reification) in `RealmManager`
*   **File:** [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
*   **Logic:**
    *   Add a `/realm shutdown` command inside `_registerCLI()`:
        ```javascript
        else if (sub === 'shutdown') {
            const realmId = activeId;
            if (!realmId || realmId === 'platonic') {
                return log("No active spatial realm to shut down.", 'error');
            }
            try {
                log({ text: `Shutting down and de-reifying realm '${realmId}'...`, color: 'orange' });
                await this.shutdownRealm(realmId);
                log({ text: `Realm '${realmId}' has cleanly collapsed into somatic sleep. Returning to Platonic Lobby.`, color: 'green', bold: true });
            } catch (e) {
                log({ text: `Shutdown Failed: ${e.message}`, color: 'red' });
            }
        }
        ```
    *   Implement `shutdownRealm(realmId)` to de-reify the somatic body:
        1.  **Resolve and Uninstall Dynamic Bundles:** Query the hierarchy's bundles, find their active references, and call `bundle.uninstall()`. **Strictly exclude primordial plane bundles (`_primordialBSNs`) and manual inhabitant-layer bundles (`_manualBSNs`) to guarantee framework stability.**
        2.  **Eject to Lobby:** Switch the active realm in both `RealmManager` and `SessionService` back to `'platonic'`. Revert `activeBeingId` back to the Grounding Soul ID (the tenant registered in the Platonic stack). Trigger `session.logout(realmId)` to clean up the spatial stack.

### Objective 4: Build the L2 Somatic Viewport inside `Stratographer`
*   **Files:** [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js), [dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html)
*   **Logic:**
    *   Detect if L2 Inhabitation is active via `session.activeBeingId.startsWith('realm:')`.
    *   In the topology graph (`refreshTopology()`):
        *   Render the `realm:*` Being as the green active observer node (`#10b981`).
        *   Render the unattended L1 surrogate (`daniel`) as a standard resident/visitor node (purple/cyan) flowing through the L2 graph body.
    *   Add an "L2 Somatic Viewport" HUD widget to the dashboard layout. The widget will query and display the L2 Being's interoceptive metrics:
        *   **`SynapticSense` (Visceral Sensation):** Active CPU heaps, bundle load states, and dynamic bundle surge maps.
        *   **`SoilSense` (Epistemic Memory Sensation):** Active configuration transaction flows (scanned PID keys from localStorage bedrock).
        *   **`BlanketSense` (Exteroception):** The active cellular flow of nested L1 occupants inside the topology.

---

## 3. Verification & Testing

Create a Deno integration test inside [tests/realm-as-being.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/realm-as-being.test.ts) (or update [tests/ontology-harmony.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/ontology-harmony.test.ts)).

### Integration test scenarios to run:
1.  **Shift to L2 Focus:** Verify shifting the session active being focus to `realm:org.neverplayed.realm.empty` succeeds and does not trigger the Grounding Soul lock violation.
2.  **Coasting Husk Verification:** Confirm that the L1 surrogate (`daniel`) remains in the spatial stack with `loggedIn = true` after shifting focus to L2.
3.  **Unattended Holon Decay:** Run the homeostasis step and verify that the L1 surrogate is cleanly logged out of the spatial stack due to attention exhaustion, while the L2 focus is successfully maintained.
4.  **Somatic Shutdown & De-reification:** Trigger `/realm shutdown` and assert that:
    *   The dynamic bundles belonging to the spatial realm are uninstalled.
    *   The protected primordial plane bundles (e.g. Stratographer, Event Admin, Session Service) are preserved intact.
    *   The active scope and being focus are successfully ejected back to the Platonic Lobby.

---

## 4. Architectural Rules

*   **Primordial Protection:** Never allow the shutdown sequence to touch or uninstall primordial plane bundles.
*   **Decoupled State:** Maintain absolute separation between symbolic state (headlessly tracked by `RealmCognitionService`) and visual representation in the Stratographer dashboard.
