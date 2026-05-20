# Handover Ticket: Identity Stack Residency Drift in Realist Mode

- **From:** Forensic Analyst
- **To:** Development Engineer
- **Context:** During testing of the realist perspective switch after multi-realm logins, a bug was found where the second resident (e.g., Rob) does not show up in either the resident identity pane in the Stratographer dashboard or the header session user dropdown, even though they exist in `scopedUsers`.

## Objectives
- [ ] **Fix `getInhabitants()` bug in `org.neverplayed.stratum-core`**:
  - In [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L92-L109), the method `getInhabitants()` iterates over `Object.values(this._sourceSession.scopedUsers)` using a variable `u`.
  - It checks `if (u.id) inhabitants.add(u.id);`.
  - However, `scopedUsers` has scope IDs as keys (e.g., `"global"`, `"org.neverplayed.realm.governance"`) and "scope stacks" as values. A scope stack is a dictionary of users/identities logged into that scope, plus a special `__activeId__` key.
  - As a result, `u` is the stack dictionary, not a user object. Therefore `u.id` is always `undefined`, and residents in the scopedUsers stack are never added.
  - Fix this by correctly iterating over the values inside each stack object (e.g., `Object.values(stack).forEach(user => { if (user && typeof user === 'object' && user.id) inhabitants.add(user.id); })`).
- [ ] **Add Unit Test**:
  - Add a unit test to [stratum-logic.test.ts](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/tests/stratum-logic.test.ts) to verify that `getInhabitants()` aggregates inhabitants correctly from the scopedUsers stacks.
  - Run `deno test --no-check -A --location http://localhost public/bundles/org.neverplayed.stratum-core/tests/` to ensure all tests pass.

## Relevant Files
- [public/bundles/org.neverplayed.stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L92-L109)
- [public/bundles/org.neverplayed.stratum-core/tests/stratum-logic.test.ts](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/tests/stratum-logic.test.ts)
