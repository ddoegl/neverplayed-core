# Handover Ticket: Platonic Sovereignty & Universe Reset

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have refined our primordial session ontology. The legacy `'global'` scope stack is now a direct reactive alias of the `'platonic'` staging lobby stack (as there is only nothingness beyond the Platonic space). The authenticated user is established as the absolute Grounding Soul (Session Tenant), and no other identity can exist in the Platonic Lobby. Logging out of the Platonic Lobby collapses the primordium, triggering a complete system reboot (Genesis).

---

## Objectives

You must implement the following architectural rules:

### 1. Implement Platonic-Global Unification
- [ ] In the Session Service ([org.neverplayed.session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)), ensure that `scopedUsers.global` is defined as a reactive property alias returning/setting `scopedUsers.platonic`.
  - Use `Object.defineProperty` on `scopedUsers` with a custom getter and setter so that mutating or reading `'global'` stack entries maps directly to the `'platonic'` object.
- [ ] In the `currentUser` getter and fallback lookups, normalize `'global'` references to default to `'platonic'`.

### 2. Lock Grounding Soul & Enforce Platonic Sovereignty
- [ ] In `login(user, scope, surrogate)`:
  - Normalize any incoming `'global'` scope strings to `'platonic'`.
  - **Rule 1 (Locking the Soul):** The very first non-guest identity to register a login becomes the **Grounding Soul** (stores `this.activeBeingId = identityId` and `this.scopedUsers['platonic'].__activeId__ = identityId` via `setBeingFocus`). Once set, this focus is locked and cannot change during the session.
  - **Rule 2 (Primordial Exclusivity):** If `activeBeingId` is already set, any attempt to log in as a *different* identity within `targetScope === 'platonic'` must be blocked, throwing a clear Ontological Violation boundary error:
    `"Ontological Violation: Only the Grounding Soul (${this.activeBeingId}) can inhabit the Platonic Staging Lobby. Other identities must be impersonated inside spatial realms."`
  - **Rule 3 (Spatial Impersonations):** Logins to other identities (e.g. `rob`) are fully permitted when the target scope is a spatial realm (not `'platonic'`). They establish a local resident stack in that scope, allowing persistence context to sync as:
    * `tenantId`: Grounding Soul ID (e.g., `daniela`)
    * `identityId`: Active resident persona ID (e.g., `rob`)
    * `realmId`: Spatial realm ID

### 3. Implement Total Universe Reset (Genesis)
- [ ] In the `logout(scope, userId)` method:
  - If `scope === 'platonic'` or `scope === 'global'`:
    - Log: `"Dissolving the primordium. Triggering total system reset..."`
    - Wipe `localStorage` clean.
    - Invoke `persistenceManager.clear({ global: true })` if available.
    - Trigger `location.reload()` (or throw a `GenesisInterrupt` when running headlessly in tests) to reboot the runtime completely out of nothingness.

### 4. Integration Verification
- [ ] Create a dedicated integration test suite `tests/grounding-soul.test.ts` to assert:
  - Accessing `scopedUsers.global` references the exact same object as `scopedUsers.platonic`.
  - The first login in `'platonic'` successfully locks the `activeBeingId` / Grounding Soul.
  - Attempting to log in as a second user in `'platonic'` throws a boundary violation error.
  - Logging into a spatial realm (e.g. `habitat`) as another user works, keeping Tenant as the Grounding Soul, while Identity is the spatial user.
  - Logging out of the Platonic Lobby triggers a complete wipe and a reload/Genesis interrupt.
- [ ] Ensure that all regression tests pass:
  ```bash
  deno task test --no-check
  ```

---

## Relevant Files
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [org.neverplayed.session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- [org.neverplayed.realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
- [tests/grounding-soul.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/grounding-soul.test.ts)
