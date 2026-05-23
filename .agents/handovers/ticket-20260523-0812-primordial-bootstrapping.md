# Handover Ticket: Implement Primordial Bootstrapping & Global Session Anchor

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have formalized the "Primordial Bootstrapping & Perceptual Co-Arising (Genesis)" model in the project ontology. After a data reset, the universe must unfold by awakening the Core Realm using a global session ledger. Configuration PIDs must act as active stigmergic traces that are sensed by the Core Realm to reify the bundles and UI components.

---

## Objectives

You must implement the following architectural updates:

### 1. Route Session State to the Global Bootstrap Anchor
- [ ] In [persistence-localstorage/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.persistence-localstorage/activator.js), update the `getPhysicalKey` resolution logic for bootstrap keys. 
- [ ] Map any key starting with `pandino.session` (like `pandino.session.state`) to the global anchor:
  - From: `np:v1:guest:unknown:guest:${key}`
  - To: `np:v1:global:__global__:__shared__:${key}` (which maps to `np:v1:global:__global__:__shared__:pandino.session.state`).
- [ ] Verify that all other bootstrap keys (such as `config.admin`) are resolved to this same global/shared space.

### 2. Verify Session Service Data Reset Cleanses Stale State
- [ ] Ensure that performing a Data Reset clears all user/realm specific keys but preserves/re-seeds the global bootstrap session state cleanly.
- [ ] After reset, the default `activeRealmId` must default back to `"org.neverplayed.realm.core"`, starting the Core Realm in its primordial state.

### 3. Core Realm Interoception (Proprioception & Config Traces)
- [ ] In the Core Realm activator (`org.neverplayed.realm.core/activator.js`), implement the dual interoceptive modalities:
  - **Epistemic Sensation (Config Traces):** Query the persistence manager for active `config.*` traces to reify bundle/UI components.
  - **Proprioceptive Sensation (OSGi Registry):** Track dependencies and lifecycle events using OSGi `ServiceTracker` handles (e.g. for `STRATUM_SERVICE` and `SESSION_SERVICE`), establishing them as real-time sensory receptors of the Realm’s internal synaptic state.
- [ ] Verify that the default human observer (`8fNNh7UkppadUaKJQhaiMIGzcLd2` under surrogate `'observer'`) has access to sense these reified components via the `PlexusSensor` and DOM `data-mark` matching.

### 4. Integration Verification
- [ ] Create a new integration test suite `tests/primordial-bootstrapping.test.ts` (or update `tests/ontology-harmony.test.ts`) to assert:
  - The physical key resolved for `pandino.session.state` is `np:v1:global:__global__:__shared__:pandino.session.state`.
  - A data reset leaves the global session state and primordial configs intact, correctly awakening the Core Realm.
  - The default observer is able to sense the reified UI config traces in the DOM.

---

## Relevant Files
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [persistence-localstorage/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.persistence-localstorage/activator.js)
- [org.neverplayed.realm.core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core/activator.js)
- [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
