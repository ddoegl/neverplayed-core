# Explorative Test Plan: Harmonized Configuration PoC

This guide outlines how to verify the evaluation pipeline using the **Evaluator
Dev-Tools** located in the Backoffice settings.

## Prerequisites

1. Open the **Universe Settings** (cog icon) -> **Evaluator Tracing**.
2. Notice the new **Dev-Tools** dashboard.
3. Enable **Global Log Level: TRACE** using the toggle.
4. Keep the browser DevTools Console open to see the purple/blue trace logs.

---

## Scenario 1: Modifying Global Rules

**Goal**: Verify that adding a mandatory key at the global level applies to all
users.

1. **Action**: Open **Universe Settings** -> **Rule Management**.
2. **Edit**: Find the `global` section and add a new key: `UI_EXPLORER_ACCESS`.
3. **Verify**: Go back to **Evaluator Tracing**.
4. **Test**: Enter User ID `6432432` (Anna), select Function `None`, and click
   **Execute Pipeline**.
5. **Expectation**: The "Granted Capabilities" list in the UI should now include
   `UI_EXPLORER_ACCESS`.

---

## Scenario 2: Business Function (Role) Switching

**Goal**: Verify that `WithRoleStrategy` correctly filters capabilities.

1. **Action**: In **Evaluator Tracing**, enter User ID `6786432` (John).
2. **Test A**: Select Function `None` and Execute.
3. **Test B**: Select Function `LEGALREPS` and Execute.
4. **Expectation**:
   - Test A should show a baseline set of keys.
   - Test B should show additional keys like `LEG_CONTRACT_SIGN`,
     `LEG_CASE_READ`, etc.
   - Check the console for `RuleBlock: LEGALREPS -> MATCH`.

---

## Scenario 3: Permission Bundle Enrichment

**Goal**: Verify persistence-based overrides.

1. **Action**: Open **Universe Settings** -> **License Management**.
2. **Edit**: Add `tradefinance-bundle` to Anna's `permissionbundles`.
3. **Verify**: Go back to **Evaluator Tracing**.
4. **Test**: Run evaluation for Anna (`6432432`).
5. **Expectation**: The UI should show keys from the trade-finance bundle (e.g.,
   `TF_GUARANTEE_CREATE`).

---

## Scenario 4: Performance Observation

**Goal**: Observe the speed of the compiled function.

1. **Action**: Click **Execute Pipeline** rapidly for different users.
2. **Verify**: Look at the "0ms Evaluation" indicator in the UI and the
   `Took: 0.000 ms` logs in the console.
3. **Expectation**: Even with complex rules, the compiled execution remains
   near-instant.
