# Development Engineer - Session State

## Current Goal
Await the next handover ticket or engineering assignment.

## Completed Items

### Residency Drift — `ticket-20260520-1916-residency-drift.md`
- **Bug**: `getInhabitants()` in `org.neverplayed.stratum-core/activator.js` treated each scope key of `scopedUsers` as a user object (calling `.id` directly on the stack dictionary), causing identity lookup failure.
- **Fix**: Added nested iteration — for each scope stack in `scopedUsers`, iterate its values and extract valid `user.id` entries.
- **Export**: Exported `StratumServiceImpl` class to enable direct unit testing.
- **Test**: Added `"Should aggregate inhabitants correctly from scopedUsers stacks"` to `stratum-logic.test.ts`.
- **Commit**: `80024c5` — "fix: correct getInhabitants traversal of residency stacks and add unit test"

### Scope-Isolated Inhabitants — `ticket-20260520-1951-scope-isolated-inhabitants.md`
- **Bug**: After the residency drift fix, `getInhabitants()` still performed a global scan — it pulled users from *all* scope stacks and all PM probes regardless of realm context.
- **Fix**: Resolved `const currentRealm = this.realmId` at the top of `getInhabitants()`:
  - **PM Scan Isolation**: Added `probe.context.realmId === currentRealm` guard.
  - **Session Stack Isolation**: Changed `Object.values(scopedUsers)` iteration to `scopedUsers[currentRealm]` lookup.
- **Test**: Overhauled the previous test with `"Should aggregate inhabitants correctly with scope isolation"` — validates scope switching (governance realm vs. global) filtering residents from both PM probes and session stacks.
- **Commit**: `3054be1` — "fix: isolate getInhabitants strictly to the active realm scope"

### Prior Session Work (from handover context)
- `org.neverplayed.shell-header`: Replaced `"@pandino/event-admin/EventHandler"` magic string with `EVENT_HANDLER_INTERFACE` constant.
- `org.neverplayed.stratum-core`: Added `platform-patterns.md`, `ADR-0025`, `ADR-0026` links to README.
- `org.neverplayed.stratum-core/activator.js`: Replaced `startsWith('org.neverplayed.realm')` hardcoded check with `NEVERPLAYED_PREFIX` constant.
- Architectural linter confirmed compliance for all modified bundles (zero new violations).
- Security regression suite: 8/8 tests passing.

## Pending Items
- None outstanding. All assigned handover tickets fully resolved.

## Key Decisions & Context
- **Realm Sovereignty Principle**: `getInhabitants()` must only consider the active realm. Cross-scope contamination was a design-level bug; the fix enforces realm isolation as a first-class concern.
- **StratumServiceImpl Export**: The class is now exported from `activator.js` to enable testability without going through the OSGi service registry.
- **PM Probe Contract**: `probe.context.realmId` is an established field on persistence manager entries; the guard assumes this field is populated at write time by the persisting bundle.
- **Test Pattern**: Unit tests directly mutate `_sourceSession`, `_sourcePM`, and `_sourceRealm` on the `StratumServiceImpl` instance (no mocking framework). This is the established pattern in `stratum-logic.test.ts`.
- **Branch**: All work committed to `architectural-cleanup-1`.
