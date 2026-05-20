# Handover Ticket: Scope-Isolated Inhabitants Retrieval in Stratum Core

- **From:** Forensic Analyst
- **To:** Development Engineer
- **Context:** Following the initial fix to list inhabitants, the current implementation pulls residents from *all* scope stacks in `scopedUsers` (global leakage). The goal is to restrict `getInhabitants()` to only return the inhabitants and historical traces of the *current active realm scope*.

## Objectives
- [ ] **Remediate `getInhabitants()` in `org.neverplayed.stratum-core`**:
  - Open [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L92-L109).
  - Retrieve the current active realm scope: `const currentRealm = this.realmId;`.
  - **Database Scan Isolation**: Only add `probe.context.identityId` from the persistence manager keys if `probe.context.realmId === currentRealm`.
  - **Session Stack Isolation**: Instead of scanning `Object.values(this._sourceSession.scopedUsers)`, only inspect the stack for the active realm:
    ```javascript
    if (this._sourceSession?.scopedUsers) {
        const stack = this._sourceSession.scopedUsers[currentRealm] || {};
        Object.values(stack).forEach(u => {
            if (u && typeof u === 'object' && u.id) {
                inhabitants.add(u.id);
            }
        });
    }
    ```
- [ ] **Update / Add Unit Test**:
  - In [stratum-logic.test.ts](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/tests/stratum-logic.test.ts), add a test validating that `getInhabitants()` only extracts users associated with the active realm scope and excludes users from other inactive scopes.
  - Execute `deno test --no-check -A --location http://localhost public/bundles/org.neverplayed.stratum-core/tests/` to ensure all tests pass.

## Relevant Files
- [public/bundles/org.neverplayed.stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js#L92-L109)
- [public/bundles/org.neverplayed.stratum-core/tests/stratum-logic.test.ts](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/tests/stratum-logic.test.ts)
