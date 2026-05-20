# Handover Ticket: Decoupled Stratum Core & UI Extender

- **From:** Cognitive Architect (Antigravity)
- **To:** Development Engineer
- **Date:** 2026-05-20
- **Status:** Approved for Implementation

---

## 📋 Context
As agreed in **[ADR-0176: Headless Stratum Decoupling](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0176-headless-stratum-decoupling.md)** and **[ADR-0177: Cross-Identity Persistence Routing](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0177-cross-identity-persistence-namespaces.md)**, we need to eliminate DOM globals and Alpine.js dependencies from the core OSGi layers. This resolves headless test runner failures and prevents reactive fan-in/fan-out loops in the browser.

This ticket tasks the implementation of the **pure headless `stratum-core` service**, the **new `stratum-core-dom` extender**, and the **migration of UI components** to the unified reactive store.

---

## 🎯 Objectives

### 1. Refactor `org.neverplayed.stratum-core` to be Headless
Remove all Alpine and DOM bindings to make the service 100% environment-agnostic:
- [ ] In [org.neverplayed.stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js):
  - Remove `import Alpine from "https://esm.sh/alpinejs@3.13.5";`.
  - Refactor `this._service` to be a plain JavaScript object/class.
  - Implement OSGi `EventHandler` registrations for:
    - `SESSION_CHANGED_TOPIC`
    - `REALM_CHANGED_TOPIC`
    - `PERSISTENCE_CONTEXT_CHANGED_TOPIC`
  - In the event handlers, schedule a batched microtask update (using `Promise.resolve()`) to trigger the async `_refreshInhabitants()` scan exactly once per event cycle.
  - When the state is updated, publish a notification using OSGi `EventAdmin` under the topic `org/neverplayed/stratum/CHANGED`.

### 2. Create the `org.neverplayed.stratum-core-dom` UI Extender
Create a new bundle to bridge the headless service to Alpine reactivity:
- [ ] Create a new bundle folder at `public/bundles/org.neverplayed.stratum-core-dom/`.
- [ ] Create `manifest.json` registering the activator and dependencies.
- [ ] In `activator.js`, import Alpine.js and track `STRATUM_SERVICE`.
- [ ] Register an OSGi `EventHandler` for `org/neverplayed/stratum/CHANGED`.
- [ ] Initialize the Alpine store `$store.stratum` with fields:
  - `tenantId`, `identityId`, `realmId`, `tier`, `perspective`, `inhabitants`, `residents`.
- [ ] Update the Alpine store fields reactively whenever the OSGi stratum changed event is received.

### 3. Migrate UI Components to `$store.stratum`
Refactor the UI templates to bind directly to the new global Alpine store:
- [ ] In [org.neverplayed.shell-header/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/activator.js):
  - Remove the local tracker tracking `STRATUM_SERVICE` for inhabitants syncing.
  - In `header.html`, update loops and properties (like inhabitants list or logouts) to read directly from `$store.stratum.inhabitants`, `$store.stratum.residents`, and `$store.stratum.realmId`.
- [ ] In [org.neverplayed.stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js):
  - In the `STRATUM_SERVICE` tracker, read the properties from the tracked service.
  - Register an OSGi `EventHandler` for `org/neverplayed/stratum/CHANGED` to call `refreshTopology()`, ensuring D3 redraws the graph when the context shifts.

---

## 📂 Relevant Files
* 📄 [org.neverplayed.stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js)
* 📄 [org.neverplayed.shell-header/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/activator.js)
* 📄 [org.neverplayed.stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
* 📄 [ADR-0176: Headless Stratum Decoupling](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0176-headless-stratum-decoupling.md)
* 📄 [ADR-0177: Cross-Identity Persistence Routing](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0177-cross-identity-persistence-namespaces.md)
