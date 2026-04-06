---
description: Scans the codebase for violations of established ADRs.
---
# Architect-Linter Workflow

This workflow identifies "Architectural Drift" by comparing the code against decisions documented in `docs/adr/` using the standardized linter.

// turbo
1. **Run Linter**: Run either a full or a targeted layer audit:
   - **Full Audit**: `deno task lint:arch`
   - **Layer-Based**:
     - `deno task lint:arch:core`: Platform primitives.
     - `deno task lint:arch:foundation`: Infrastructure services (Cascades to Core).
     - `deno task lint:arch:domain`: Business logic (Cascades to Foundation/Core).
2. **Analyze Output**: Review the "Bundle Audit" and "Identifier Audit" for:
   - Manifest/BSN mismatches.
   - Missing/Incomplete documentation in `public/bundles/org.neverplayed.*`.
   - Magic Strings (Drift) in activators and templates.
3. **Report Results**: 
   - **Compliant**: List ADRs/Patterns that are correctly adhered to.
   - **Violations**: Detail specific bundles and line numbers requiring remediation.
   - **Recommendations**: Propose fixes (e.g., creating READMEs or migrating identifiers to `core-types`).
