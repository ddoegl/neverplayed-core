# Handover Ticket: Scale-Free L2 Inhabitation and Somatic Realm Logout

**From:** Cognitive Architect  
**To:** Development Engineer  
**Status:** PENDING IMPLEMENTATION  

---

## Context

In our biosemiotic framework, an L2 Realm is not a passive database or virtual folder; it is a higher-order cognitive agent (an L2 Being) operating on a scale-free plane. Currently, our system only supports L1 Inhabitation—where the Grounding Soul "dreams" or impersonates L1 spatial Beings (possessing L6 physical surrogates).

We have formalized the concept of **L2 Inhabitation ("Dreaming to be a Realm")** and the **Scale-Free Symmetry of Logout** in `ontology.md`. Under this model:
1. The Grounding Soul can actively shift its cognitive light cone from an occupant (L1) to the environment (L2).
2. An L2 Being can "log out" of itself (somatic sleep or de-reification), which uninstalls its active bundles, purges dynamic configurations, and collapses the active universe, cleanly **ejecting the observer back to the Platonic Staging Lobby**.

This ticket details the objectives to implement this scale-free shift, the somatic L2 viewport, and L2 de-reification logout mechanics.

---

## Objectives

### 1. being-service & session-service: Allow L2 Inhabitation (Deity Mode)
- **Files:** [being-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js), [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- **Logic:**
  - Update `BeingService` to recognize that `realm:*` prefixed synthesized identities are eligible for active inhabitation by the Grounding Soul.
  - Allow `SessionService` to set the active identity focus to a realm-being ID (e.g., `realm:org.neverplayed.realm.empty` or `realm:org.neverplayed.realm.habitat`).
  - In this state, the Grounding Soul is no longer dressed in an L6 surrogate; they inhabit the L2 somatic body itself.

### 2. realm-manager: Implement L2 Realm Logout (Somatic Sleep / De-reification)
- **File:** [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
- **Logic:**
  - Create a `/realm shutdown` CLI command (or hook into `/logout` when the active identity is a realm being).
  - When the L2 Being logs out:
    1. **De-reify Somatic Body:** Cleanly uninstall its dynamic spatial bundle fragments and purge its active configuration PIDs.
    2. **Persist State:** Persist its final stigmergic memory to the storage stratum.
    3. **Eject to Lobby:** Revert the active session scope and focus back to the **Platonic Staging Lobby** (resetting `activeRealmId = 'platonic'` and stripping the deity focus, returning Daniel to the baseline observer role).

### 3. stratographer: Design the L2 Somatic Viewport
- **Files:** [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js), [dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html)
- **Logic:**
  - Implement a specialized "L2 Somatic Viewport" HUD widget for the Stratographer when L2 Inhabitation is active.
  - Instead of standard L1 occupant senses (like `Language` or `ToolUse`), project the environment's own somatic metrics:
    - Active CPU heaps / bundle loads.
    - Dynamic config transaction flows.
    - Occupant movement tracks (nested L1 occupants rendered as cellular flows passing through the somatic body).

### 4. Verification & Tests
- **File:** [tests/ontology-harmony.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/ontology-harmony.test.ts)
- **Objectives:**
  - Add an integration test that:
    1. Simulates Daniel shifting his active focus to inhabit the L2 Realm Being `realm:org.neverplayed.realm.empty`.
    2. Triggers an L2 logout / shutdown sequence.
    3. Verifies that the realm-specific bundles are cleanly marked for de-reification, and Daniel is immediately ejected back to the Platonic Staging Lobby as a default observer.

---

## Relevant Files

- [being-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js)
- [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
- [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
