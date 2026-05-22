# Handover Ticket: Active Spectating, Dual-State Observers & Residency Pruning

*   **From:** Cognitive Architect (Antigravity)
*   **To:** Development Engineer (dev)
*   **Context:** Following the implementation of unified transition execution, we noticed three areas that need refinement to align with the project ontology:
    1. **Hidden Self-Forensics**: Since the active user is always represented as an `Observer` (Emerald Green), they can no longer visually see if they also have historical `Trace-Maker` footprints in that realm.
    2. **Loss of Spectating Context**: The active user cannot see who the other trace-makers are in the active realm without cluttering the topology with offline ghost nodes.
    3. **Session Stack Bloat**: Navigating across multiple realms keeps the user logged into the previous realms' residency stacks indefinitely.
    
    This ticket implements a dual-state observer ring (green inner ring, dashed amber outer ring if traces exist), a realm-level trace-maker inspector widget (revealed when clicking the active realm node), and automatic residency pruning (logout of previous realm) upon switching realms.

## Objectives

- [ ] **Dual-State Observer Visualization:**
    - Update [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js):
        - In `refreshTopology()`, check if `isActiveObserver` is true and the being's ID is present in `traceMakers`.
        - If so, set its `borderType` to `'double-trace'` (and optionally update the node label to indicate it has traces). Do this for both standard beings and dynamic/fallback observers.
        - In `_renderGraph()`, update the outer ring filter: `.filter(d => d.borderType === 'double' || d.borderType === 'double-trace')`.
        - For `'double-trace'`, render the outer circle with a dashed amber stroke: `stroke: '#f59e0b'`, `stroke-dasharray: '3,3'`.

- [ ] **Realm-Level Trace-Maker Inspector:**
    - Update [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js):
        - In `inspectVault(node)`, initialize `store.activeNodeTraceMakers = []`.
        - If `node.id.startsWith('realm:')` and the `node.realmId` matches the active realm ID, fetch the list of trace-makers using `await self._stratum.getTraceMakers()` and store it in `store.activeNodeTraceMakers`.
    - Update [dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html):
        - Render a new widget section titled `"Realm World Model: Trace-Makers"` right above the `"Forensic Vault Traces"` section in the right pane.
        - The widget should only display if the active node is a realm and `activeNodeTraceMakers` contains entries. Use a clean card list formatting in Alpine.js (`x-for="tm in $store.explorer.activeNodeTraceMakers"`).

- [ ] **Session Residency Pruning on Switch:**
    - Update [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js):
        - In `_executeTransition()`, capture `previousRealmId` from `this.session.activeRealmId`.
        - If `previousRealmId` is valid and different from the destination `realmId`, call `this.session.logout(previousRealmId)` before establishing the new active realm focus and executing `session.login()`.

- [ ] **Verification & Assertions:**
    - Run the regression tests: `deno test -A tests/run-all.ts`
    - Update `tests/ontology-harmony.test.ts` to add test assertions for:
        1. Checking that switching realms correctly prunes the occupant stack of the previous realm.
        2. Verifying that the active observer node is assigned `'double-trace'` border style if the observer is in `traceMakers`.
        3. Verifying that clicking/inspecting the active realm node populates `activeNodeTraceMakers` in Alpine.

## Relevant Files

- [public/bundles/org.neverplayed.stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
- [public/bundles/org.neverplayed.stratographer/templates/dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html)
- [public/bundles/org.neverplayed.realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
- [tests/ontology-harmony.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/ontology-harmony.test.ts)
