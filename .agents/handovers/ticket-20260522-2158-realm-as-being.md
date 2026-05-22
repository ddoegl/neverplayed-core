# Handover Ticket: Implement Realm as a Being (TAME)

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have formalized the ontology and finalized the implementation proposal for treating a Realm as a high-order cognitive Being. The user has approved the proposal and selected **Pattern A: Just-in-Time (Lazy) Homeostasis** for handling temporal decay and stale occupant pruning. This ensures zero CPU overhead when the application is idle.

---

## Objectives

You must implement the finalized proposal in [realm-as-being-implementation-proposal.md](file:///Users/ddoegl/speckit/neverplayed/.agents/proposals/realm-as-being-implementation-proposal.md):

### 1. Dynamic Realm-Being Identity Synthesis
- [ ] Update `BeingService` (`org.neverplayed.being-service/activator.js`) to dynamically generate Being records when queried for `realm:*` prefixed identities.
- [ ] Add the system-level surrogates (`sovereign-guard` and `system-collector`) to [surrogates.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/surrogates.yaml) with the appropriate senses (e.g., `ForensicVision`, `ArchitectControl`, `SpaceReclamation`).

### 2. Implement the Event-Driven TAME Engine
- [ ] Define the `org.neverplayed.realm.RealmCognitionService` interface constant.
- [ ] In the core realm activator (`org.neverplayed.realm.core/activator.js`), implement the cognition service and register as an OSGi `EventHandler` listening to:
  - `org/neverplayed/session/CHANGED`
  - `org/neverplayed/realm/CHANGED`
  - `org/neverplayed/persistence/CHANGED`
- [ ] Implement `homeostasisStep()` to run within a `queueMicrotask` callback upon handling events (Pattern A):
  - Calculate prediction error based on stale residents (inactive for >30s) or persistence drift.
  - Perform active inference: logout/prune stale residents and verify state recovery.
  - Expose `getPredictionError()`.
- [ ] Ensure the OSGi capabilities (the cognition service and event handler) are advertised in the realm's `manifest.json`.

### 3. Stratographer Visualizations (Aesthetics & HUD)
- [ ] In the Stratographer D3 node renderer (`org.neverplayed.stratographer/activator.js`), decorate Realm Being nodes with a dynamic, pulsing border when their prediction error is greater than 0.
- [ ] Extend the dashboard HTML layout to display the **Realm Cognition HUD Widget** in the sidebar when a Realm node is selected.
- [ ] Bind the widget using Alpine.js to show:
  - Cognitive Light Cone: `Session (Lazy Horizon) / Spatial Bedrock`
  - Active Surrogate: `sovereign-guard` or `system-collector`
  - Real-time Prediction Error value.

### 4. Verification & Deno Test Suite
- [ ] Add unit and integration tests in the `tests/` directory verifying:
  - Synthesis of realm identities by `BeingService`.
  - Reactive prediction error calculation and lazy occupant pruning upon state events.
  - Compliance of manifests with ADR-0022 capability advertising.

---

## Relevant Files
- [.agents/proposals/realm-as-being-implementation-proposal.md](file:///Users/ddoegl/speckit/neverplayed/.agents/proposals/realm-as-being-implementation-proposal.md)
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [org.neverplayed.being-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js)
- [org.neverplayed.being-service/data/surrogates.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/surrogates.yaml)
- [org.neverplayed.realm.core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm.core/activator.js)
- [org.neverplayed.stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
