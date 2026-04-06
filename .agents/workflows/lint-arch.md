---
description: Scans the codebase for violations of established ADRs.
---
# Architect-Linter Workflow

This workflow identifies "Architectural Drift" by comparing the current code against decisions documented in `docs/adr/`.

1. **Scan ADRs**: Read all accepted ADRs in `docs/adr/` to establish the "Ground Truth".
2. **Analyze Codebase**: Scan the current working directory's code (especially bundles, activators, and UI components).
3. **Identify Drift**: Report any code that violates the patterns defined in the ADRs.
4. **Report Results**: 
   - **Compliant**: List ADRs that are correctly adhered to.
   - **Violations**: Detail specific files and line numbers where "Architectural Drift" is detected.
   - **Recommendations**: Propose fixes to realign the code with the ADRs.
