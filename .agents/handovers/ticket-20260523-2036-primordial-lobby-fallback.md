# Handover Ticket: Primordial Lobby & Global Observer Fallback

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have formalized the "Primordial Lobby & Global Observer Fallback" model in the ontology. We need to decouple authentication from inhabitation by introducing a virtual staging lobby context that serves as the root coordinates (`np://<tenantId>/<userId>/`) before entering or after departing any spatial realm.

---

## Objectives

You must implement the following lifecycle updates:

### 1. Implement the Primordial Lobby Scope
- [ ] In the Session Service ([org.neverplayed.session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)), support `activeRealmId = null` (or a virtual `"global"` string scope) as a valid non-spatial state.
- [ ] Ensure that immediately upon authentication, the user is registered in the session as a global Being and automatically provisioned with the default **`observer`** surrogate.
- [ ] Map the physical URI in the persistent stratum for the lobby to:
  `np://<tenantId>/<userId>/`
  Ensure that when `activeRealmId` is null, the Stratum URL resolves to this structure.

### 2. Implement the Realm Chooser in the Shell UI
- [ ] In the sidebar UI ([org.neverplayed.shell-sidebar](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-sidebar/)) or main workspace layout, listen to the active realm context.
- [ ] When `activeRealmId === null` (or `"global"`), render a clean, visual **Realm Chooser** widget displaying all registered realms. Selecting a realm should execute `realmManager.switchRealm(realmId)`.

### 3. Decouple Logout and Fallback to Lobby
- [ ] Update the logout sequence in `SessionService` and `RealmManager`:
  - When the user logs out of the active realm (e.g. via an exit button or due to homeostasis active inference pruning), do not disconnect their session.
  - Instead, clear the active realm reference (`activeRealmId = null`), dissolve any realm-specific active surrogate, and fall back to the global `observer` surrogate in the Primordial Lobby.

### 4. Optional Landing Realm Shortcut
- [ ] Add support for a `landingRealmId` configuration property (e.g., in `config.org.neverplayed.realm-manager`).
- [ ] If defined (e.g. set to `"org.neverplayed.realm.core"`), the system should automatically switch to this realm immediately after the initial authentication completes.
- [ ] Ensure that logging out of this landing realm still correctly drops the user back to the Primordial Lobby.

### 5. Integration Verification
- [ ] Create a new test suite `tests/primordial-lobby.test.ts` to assert:
  - Shifting context to the lobby resolves the URI to `np://<tenantId>/<userId>/`.
  - Logging out of an active realm (e.g. `habitat`) returns `activeRealmId` to `null` (or `"global"`) and sets the active surrogate back to `observer`.
  - Auto-login to a configured landing realm works on first boot, and logging out of it reverts to the lobby.
- [ ] Verify that all 12/12 regression tests pass:
  ```bash
  deno task test
  ```

---

## Relevant Files
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [org.neverplayed.session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
- [org.neverplayed.realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
- [org.neverplayed.shell-sidebar/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-sidebar/activator.js)
