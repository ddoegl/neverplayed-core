# Developer Handover: Scale-Free Homeostasis & L1 Agentic Autonomy (Falling Asleep)

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** 
  We are unifying the active inference architecture of the *Never Played* ecosystem under Michael Levin's TAME framework. Instead of the L2 Realm Mind managing occupant lifespans from above, L1 individual Beings must act as self-governing homeostatic agents that manage their own temporal decay. A Being in a static environment experiences attention exhaustion (sensory boredom) and voluntarily "falls asleep," dissolving its spatial form and retreating back to the Platonic Staging Lobby.

---

## Actionable Objectives

### 1. Session Service Refactoring (L1 Temporal Homeostat)
* **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
* **Actions:**
  - Introduce an L1 Homeostasis scheduler in the `SessionService` startup lifecycle.
  - Implement a `_scheduleHomeostasis()` mechanism that runs a lazy, JIT `homeostasisStep()` via `queueMicrotask` (or whenever session events, UI interactions, or logins are processed).
  - Inside `homeostasisStep()`:
    - Iterate over all active occupants in all spatial scopes (`this.scopedUsers`).
    - If any spatial user has been inactive for >30 seconds (`Date.now() - user.lastActiveTime > 30000`), the Being's internal attention prior is violated.
    - **Self-Eviction (Active Inference):** Trigger the Being's own logout from that spatial scope: `this.logout(scope, userId)`.
    - If the evicted user represents the active occupant of the active spatial realm (`this.activeRealmId === scope`), the session service must automatically transition `activeRealmId` back to `'platonic'`, reverting the Being to a naked observer in the Platonic Lobby.

### 2. Realm Manager Refactoring (Decoupled L2 Homeostasis)
* **File:** [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
* **Actions:**
  - Delete **Exteroceptive Homeostasis & Stale Occupant Pruning** (delete lines 1486–1529).
  - The `RealmManager`'s `homeostasisStep()` should now focus *strictly* on its L2-specific homeostatic variables: **Exteroceptive config scans** (list config keys via `pm.listKeys("config.")` and update `cognition.reifiedPids`) and broadcasting the completion event.
  - This establishes a clean, decoupled boundary where L1 Beings govern their own lifetimes, while the L2 Realm strictly manages spatial configurations.

### 3. Verification & Tests
* **File:** [realm-as-being.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/realm-as-being.test.ts)
  - Refactor the homeostasis tests (specifically Case 2 and Case 3) to assert that:
    1. The temporal decay check is canonically executed and driven by the `SessionService` rather than the `RealmManager`.
    2. Evicting a stale occupant accurately triggers the lobby fallback, moving `session.activeRealmId` to `'platonic'`.
  - Run the regression suite to ensure all 14/14 tests pass 100% green:
    ```bash
    deno task test --no-check
    ```

---

## Relevant References & Memory Anchors
- **Ecosystem Constitution:** Section 11 in [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md) establishes the formal metaphysics of scale-free homeostasis, attention exhaustion, and the stigmergic boundary.
