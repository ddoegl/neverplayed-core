---
description: Executes unit and integration tests for a specific bundle or layer to verify functional integrity.
---

1. **Asses Scope**: Identify the target bundle path (e.g. `public/bundles/org.neverplayed.shared-ui`).
2. **Run Unit Tests**: 
   - Execute `deno test -A --location http://localhost <bundle-path>/tests/`.
   - Ensure a test harness (like `JSDOM` or `test-harness.ts`) is used for UI components.
3. **Run Coverage Logic** (Optional):
   - Execute `deno test -A --coverage=cov_profile <bundle-path>/tests/`.
   - Generate report: `deno coverage cov_profile`.
4. **Report Results**:
   - Provide a summary of passed/failed assertions.
   - For any failures, extract the specific error and stack trace to guide the repair.
5. **Quality Verification**:
   - Check if the bundle's `README.md` reflects the current testing state via the **Documentation Health** and **Test Coverage** badges.
   - If missing, run `/lint-arch --fix` to update the badges.
