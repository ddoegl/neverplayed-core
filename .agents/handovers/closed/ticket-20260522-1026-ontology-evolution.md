# Handover Ticket: Project Ontology Alignment & Naming Harmonization

- **From:** Cognitive Architect (Antigravity)
- **To:** Development Engineer
- **Date:** 2026-05-22
- **Status:** 🟢 Closed — Implemented (Ontology Section 5 Targets)

---

## 📋 Context & Objectives

To bring the technical implementation of the *Never Played* codebase in line with the formal [Project Ontology](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md), we need to address two primary planned evolution targets:
1. **Introduce Sovereign Origin Mapping:** Establish a permanent home/origin realm anchor for each Being.
2. **Harmonize Resident/Inhabitant Naming:** Resolve semantic inversions in technical getters to align with the core entities definitions (Resident = roots, Occupant = transient presence, Inhabitant = the union of both).

---

## 🎯 Objectives

### 1. Introduce Sovereign Origin Mapping (L1)
Add a permanent origin realm mapping to Beings to support the Native/Denizen distinction:
- [ ] In [being-service/data/beings.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/beings.yaml):
  - Add `originRealmId` property to the Being definitions (or rename `initial.realm` to `initial.originRealmId`).
- [ ] In [being-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js):
  - Refactor `getBeingHome(beingIdOrType)` to resolve home realms via `being.originRealmId` or `being.initial?.originRealmId`, falling back to `being.initial?.realm` or legacy policies for compatibility.
- [ ] In [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js):
  - Expose `originRealmId` on the reactive `currentUser` identity object so it can be queried by other services and UI components.

### 2. Rename & Align Technical Getters in `stratum-core` & UI
Eliminate semantic inversion inside `stratum-core` and implement presence-based inhabitation:
- [ ] In [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js):
  - Rename the getter `get residents()` to `get occupants()` (representing active session-bound beings in the current realm).
  - Rename the method `getInhabitants()` to `getTraceMakers()` (representing persistence-bound/historical trace creators in the current realm).
  - Introduce a new computed `getInhabitants()` method that returns all beings with presence (active or forensic) in this realm:
    $$\text{Inhabitants} = \text{occupants} \cup \text{traceMakers}$$
  - Update `_broadcastChanged()` to publish the updated properties (`occupants`, `traceMakers`, `inhabitants`) under the `STRATUM_CHANGED_TOPIC` event.
- [ ] In [stratum-core-dom/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core-dom/activator.js):
  - Update the Alpine store `$store.stratum` bindings to expose `occupants`, `traceMakers`, and `inhabitants` reactively.

### 3. Harmonize Pane Labeling & Visual Appearances
Update UI panes and node visualization to reflect the resolved ontological states:
- [ ] In [shell-header/templates/header.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/templates/header.html):
  - Rename the header persona dropdown heading `"Available Inhabitants"` to `"Active Beings"`.
  - Refactor binding loops referencing `$store.stratum.inhabitants` to point to the new getters.
- [ ] In [stratographer/templates/dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html):
  - In the left HUD pane: Rename `"Resident Identity"` to `"Active Being"` and `"Other Residents"` to `"Other Occupants"`.
- [ ] In [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js):
  - Track the `BEING_SERVICE` to resolve the `originRealmId` for each inhabitant node.
  - In `refreshTopology()`, differentiate and visualize the **Quality of Appearance** for each node representing a being:
    1. **Active Observer (Current Being)**:
       - *Condition*: `identId === beingId`
       - *Visual*: Solid Emerald Green (`#10b981`), double border/ring.
       - *Label*: `"Observer"`
    2. **Present Resident (Native Active)**:
       - *Condition*: `originRealmId === realmId` and `identId ∈ occupants`
       - *Visual*: Solid Purple/Indigo (`#a855f7`), thick white/slate border.
       - *Label*: `"Resident"`
    3. **Present Transient (Visitor Active)**:
       - *Condition*: `originRealmId !== realmId` and `identId ∈ occupants`
       - *Visual*: Solid Cyan/Teal (`#22d3ee`), standard border.
       - *Label*: `"Visitor"`
    4. **Ghost / Forensic Trace-Maker (Offline but has traces)**:
       - *Condition*: `identId ∉ occupants` and `identId ∈ traceMakers`
       - *Visual*: Warm Amber (`#f59e0b`), semi-transparent (60% opacity), dashed stroke.
       - *Label*: `"Trace-Maker"`
    5. **Absent Resident (Native Offline & no traces)**:
       - *Condition*: `originRealmId === realmId` and `identId ∉ occupants` and `identId ∉ traceMakers`
       - *Visual*: Desaturated Slate Gray (`#64748b`), dotted stroke.
       - *Label*: `"Offline Resident"`
  - In the D3 graph rendering function (`_renderGraph`), dynamically apply these CSS/SVG stroke properties (stroke-dasharray for dashed/dotted strokes, opacity, and custom colors).

### 4. Add Regression & Integration Tests
Verify the semantic refactoring and origin mapping rules:
- [ ] Add integration tests (e.g. `tests/ontology-harmony.test.ts`) that assert:
  - Being profiles correctly expose `originRealmId`.
  - `stratum.occupants` returns active occupants in the realm.
  - `stratum.getInhabitants()` returns the union of occupants and traceMakers in the realm.

---

## 📂 Relevant Files

- 📄 [ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md) — Source ontology reference
- 📄 [being-service/data/beings.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/beings.yaml) — Being profile seeds
- 📄 [being-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js) — Being service layer
- 📄 [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) — Technical getters to rename
- 📄 [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js) — D3 visualization mapper
- 📄 [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) — Reactive session state

---

## 🔍 Verification

### Automated Tests
- Run the Deno test runner:
  ```bash
  deno test -A tests/run-all.ts
  ```
