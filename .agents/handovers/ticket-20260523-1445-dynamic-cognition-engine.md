# Handover Ticket: Platform-Provisioned Dynamic Cognition Engine (DRY & Config-over-Code)

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have formalized the "Decoupled UI Apertures & DOM Senses" model in the ontology. Rather than writing custom code bundles and DOM adapters for each individual realm, the platform (`RealmManager`) will dynamically provision a `RealmCognitionService` for *every* registered realm, keeping the codebase DRY and 100% configuration-driven.

---

## Objectives

You must implement the following refactoring:

### 1. Delete Custom Core Realm & DOM Adapter Bundles
- [ ] **Delete** the custom code bundle folder: [public/bundles/org.neverplayed.realm.core](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core/)
- [ ] **Delete** the custom UI adapter folder: [public/bundles/org.neverplayed.realm.core-dom](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core-dom/)
- [ ] Remove both bundles from the preloading registrations in [core.json](file:///Users/ddoegl/speckit/neverplayed/public/realms/core.json).

### 2. Implement the Dynamic TAME Engine in Realm Manager
- [ ] In the Realm Manager activator ([org.neverplayed.realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)):
  - Track `PERSISTENCE_MANAGER_SERVICE` if not already tracked.
  - When registering a realm (`registerRealm`), dynamically instantiate a cognition loop and register a service under `org.neverplayed.realm.RealmCognitionService` with service property `"realm.id": manifest.id`.
  - Maintain a map of active service registrations (`this._cognitionRegs`) to clean them up on unregistration.
- [ ] Implement a centralized, event-driven homeostasis loop inside the Realm Manager:
  - Register as an `EventHandler` on session/realm/persistence/stratum changed topics.
  - On events, schedule a centralized `homeostasisStep` using `queueMicrotask`.
  - In `homeostasisStep`, iterate over all registered realms:
    1. **Epistemic Config Scan:** Query the persistence manager for active `config.*` traces and compute `reifiedPids`.
    2. **Exteroceptive Homeostasis:** If the realm is currently active, scan its occupant stack in the session. If any user has been inactive for >30s, execute active inference (prune/log out stale occupants).
    3. **Broadcast Completion:** Dispatch a global CustomEvent `"realm-homeostasis-completed"` carrying `{ realmId, reifiedPids }`.

### 3. Programmatic Plexus Sensation in Stratographer
- [ ] In [org.neverplayed.stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js):
  - Track all registered `RealmCognitionService` instances by their `realm.id` property.
  - Update `inspectVault(node)`: if a Realm node is clicked, query its cognition service, retrieve the reified PIDs, and programmatically filter them using `PLEXUS_SENSOR_SERVICE.sense(entity)` to verify observer visibility.
  - Expose the filtered array as `$store.explorer.realmCognition.sensedComponents`.
  - If the active Observer node is selected, retrieve the sensed components for the current active realm.
- [ ] In [dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html):
  - Update the **Realm Cognition Panel** HUD widget to render the list of `sensedComponents` inside the sidebar details.
  - Under the active Observer details card, display the list of active sensed components.

### 4. Integration Verification Tests
- [ ] Update [tests/realm-as-being.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/realm-as-being.test.ts):
  - Remove installation of `org.neverplayed.realm.core`.
  - Assert that `RealmManager` dynamically registers `RealmCognitionService` and executes the active inference loop.
- [ ] Update [tests/primordial-bootstrapping.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/primordial-bootstrapping.test.ts):
  - Remove installation of `org.neverplayed.realm.core` and `org.neverplayed.realm.core-dom`.
  - Assert that reified config traces are programmatically sensed by the default observer via the `PlexusSensor` and that the Stratographer store is correctly populated.
- [ ] Run the global regression suite to verify that all 12/12 tests pass successfully:
  ```bash
  deno task test
  ```

---

## Relevant Files
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [org.neverplayed.realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
- [org.neverplayed.stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
- [org.neverplayed.stratographer/templates/dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html)
- [tests/realm-as-being.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/realm-as-being.test.ts)
- [tests/primordial-bootstrapping.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/primordial-bootstrapping.test.ts)
