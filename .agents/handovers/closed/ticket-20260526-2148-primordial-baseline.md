# Handover Ticket: Enforce Primordial Sensation Floor and Surrogate Carry-over

**From:** Cognitive Architect  
**To:** Development Engineer  
**Status:** DRAFT / PENDING IMPLEMENTATION  

---

## Context

When logging into a spatial realm (like the Empty realm `org.neverplayed.realm.empty`) as `rob` with no explicit surrogate, the resident currently becomes "naked" with no active surrogate. Because there was no sensory floor, the resident experienced total sensory blindness.

To resolve this conceptual and functional gap, the project constitution and `ontology.md` have been updated with two new biosemiotic principles (Section 11):
1. **The Primordial Sensation Floor (Naked Baseline):** A resident without a physical L6 surrogate form must retain a visceral platform-level baseline awareness: the `"Primordial"` sense. Core platform organs (such as reified PIDs in the Stratographer graph) must be reified under `"Primordial"` rather than `"Language"`, allowing naked observers to perceive the platform bedrock and trigger homeostatic attention refreshes.
2. **Surrogate Carry-over (Traveler's Clothing):** When transitioning into a spatial realm with no explicit surrogate parameter, the session service will dynamically inherit/carry over their active surrogate state from their previous active scope or their baseline Platonic profile, provided the incoming realm manifest's `recognizedSurrogates` list allows it.

This ticket details the concrete implementation objectives to enforce these principles across session, perceiver, and stratographer services.

---

## Objectives

### 1. session-service: Implement Surrogate Carry-over in `login()`
- **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- **Target:** Inside the `login(user, scope = null, surrogate = undefined)` method.
- **Logic:**
  If the `surrogate` argument is `undefined` (meaning no explicit surrogate parameter was passed to `/login`), the target scope is a spatial realm (not `'platonic'`), and the identity is not `'guest'`:
  - Dynamically resolve the target realm's manifest from the tracked `REALM_MANAGER_SERVICE` (`this._realm`) via its `getRealms()` method.
  - Extract the target realm manifest's `recognizedSurrogates` list (defaulting to an empty array).
  - Retrieve the user profile's current active surrogate and possessed surrogates from other scopes using `this._findIdentity(identityId)`.
  - Apply the following carry-over priority:
    1. If the current active surrogate ID (e.g. `'person'`) is in the target realm's `recognizedSurrogates`, carry it over successfully (`surrogate = activeSurrogate`).
    2. Else, if the user possesses *any* recognized surrogate for that realm, auto-materialize it.
    3. Otherwise, fall back cleanly to a naked resident (`surrogate = null`).
  - This ensures that a simple `/login rob` dynamically clothing-carries him over if compatible, or strips him to naked observer status when transitioning into realms with foreign/restricted manifestations (like `org.neverplayed.realm.empty`).

### 2. perceiver-service: Inject "Primordial" Sense for Naked Observers
- **File:** [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js)
- **Target:** Inside `getEnrichedSenses()`.
- **Logic:**
  - Check if the active resident is in a naked state (i.e. `this._state.surrogate` is `null` or has no `id`).
  - If so, ensure that `"Primordial"` is injected into the returned senses array (`ctx.surrogate.senses`).
  - This establishes the absolute sensory blanket baseline, guaranteeing that naked residents always possess the `"Primordial"` sense.

### 3. session-service: Allow "Primordial" to Trigger Homeostatic Refreshes
- **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- **Target:** Inside the `registerInteraction()` method.
- **Logic:**
  - Update the stigmergic sensation resonance check to include `"Primordial"` as a compatible interaction-trigger sense.
  - Change:
    ```javascript
    if (senses.includes('Language') || senses.includes('ToolUse'))
    ```
    To:
    ```javascript
    if (senses.includes('Language') || senses.includes('ToolUse') || senses.includes('Primordial'))
    ```
  - This ensures naked observers in a shared space can still sense interactions and homeostatically extend/reset their attention loops.

### 4. stratographer: Reify Platform Bedrock PIDs under "Primordial" Sense
- **File:** [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
- **Target:** Inside the `matchSense` matcher declarations for reified components (lines 481 and 506).
- **Logic:**
  - Change the matcher value from `"Language"` to `"Primordial"`:
    ```javascript
    matchers: [{ type: "matchSense", value: "Primordial" }]
    ```
  - This makes the reified system components (e.g. system configurations, Stratographer node graphs, Event Admin) ontologically reified under `"Primordial"`. As a result, naked observers can perceive the platform bedrock, while standard residents also retain visibility since `"Primordial"` is their baseline floor.

### 5. Verification & Tests
- **File:** [ontology-harmony.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/ontology-harmony.test.ts)
- **Objectives:**
  - Add an integration test validating that:
    1. A naked resident (`activeSurrogateId === null`) has the `"Primordial"` sense in `perceiver.getEnrichedSenses()`.
    2. Logging into `"org.neverplayed.realm.empty"` (which only recognizes `["observer"]`) as `rob` (who only has the `"person"` surrogate) automatically results in `activeSurrogateId = null` (naked) but with the `"Primordial"` sense floor intact.
  - Run all integration tests via Deno runner and verify that they are 100% green:
    ```bash
    deno test -A tests/run-all.ts
    ```

---

## Relevant Files

- [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js)
- [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
- [ontology-harmony.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/ontology-harmony.test.ts)
- [ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
