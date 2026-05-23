# Handover Ticket: Decouple Headless Core Realm from DOM (Aperture Sensation)

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have formalized the "Decoupled UI Apertures & DOM Senses" model in the project ontology. The core realm activator currently performs direct DOM manipulation (inserting elements into `globalThis.document`), violating the **Headless Decoupled Stratum** principle. We need to refactor the core realm bundle to be completely environment-agnostic (headless) and delegate DOM reifications to a dedicated adapter bundle.

---

## Objectives

You must implement the following architectural refactoring:

### 1. Scrub DOM References from the Core Realm
- [ ] Remove all HTML elements, `document` queries, and DOM manipulation logic from [org.neverplayed.realm.core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core/activator.js).
- [ ] Update `RealmCognitionService` to expose a new symbolic getter: `getReifiedPids()`, returning the array of string IDs (e.g., `["org.neverplayed.shell-cli"]`) that represent active reified configuration traces.

### 2. Create the Core Realm DOM Adapter Bundle
- [ ] Create a new bundle folder: `public/bundles/org.neverplayed.realm.core-dom/`
- [ ] Create [manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core-dom/manifest.json):
  - Set `Bundle-SymbolicName` to `org.neverplayed.realm.core-dom`.
  - Advertise the provided capability for `sys:realm-dom` under `Provide-Capability` (ADR-0022).
- [ ] In [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core-dom/activator.js):
  - Track `org.neverplayed.realm.RealmCognitionService` (to listen to reification state shifts).
  - Track `org.neverplayed.session.SessionService` (to monitor active realm context changes).
  - Register as an `EventHandler` on topic `org/neverplayed/session/CHANGED` or stratum events.
  - When the active realm context is `org.neverplayed.realm.core` and running in a browser runtime, dynamically mount the reified DOM components (containing the `data-mark` requiring the `"Language"` sense) into a `#core-realm-reifications` container in the document.
  - Correctly clean up/remove these DOM elements when the session logs out or switches to a different realm.

### 3. Register the DOM Adapter
- [ ] Register `org.neverplayed.realm.core-dom` in Deno test imports and the global realms catalog index ([core.json](file:///Users/ddoegl/speckit/neverplayed/public/realms/core.json)).

### 4. Integration Verification
- [ ] Update the integration test [tests/primordial-bootstrapping.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/primordial-bootstrapping.test.ts) to assert:
  - `org.neverplayed.realm.core/activator.js` contains no `document` or `globalThis.document` references.
  - `org.neverplayed.realm.core-dom` is successfully loaded and handles the reactive insertion and removal of reified DOM elements on behalf of the headless realm.
  - The default observer is still able to sense the DOM reifications when logged in.
- [ ] Run the global regression suite to verify that all 12/12 tests pass successfully:
  ```bash
  deno test -A tests/run-all.ts
  ```

---

## Relevant Files
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [org.neverplayed.realm.core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core/activator.js)
- [org.neverplayed.realm.core-dom/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core-dom/activator.js)
- [org.neverplayed.realm.core-dom/manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core-dom/manifest.json)
- [tests/primordial-bootstrapping.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/primordial-bootstrapping.test.ts)
