---
description: Synchronizes bundle documentation (README.md/manifest.json) with current architectural decisions (ADRs) and project specifications.
---

1. **Asses Current State**:
   - Locate `README.md` and `manifest.json` in the target bundle.
   - Verify compliance against `docs/bundle-readme-spec.md` and `docs/bundle-manifest-spec.md`.
2. **Scan Implementation**: 
   - Identify key services and patterns used in the code (e.g. `UIFactory`, `PathResolver`).
   - Identify which [ADRs](../../docs/adr/) are implemented (check comments/logic).
   - **JSDoc Audit**: Scan `activator.js` for missing technical documentation for services and public methods.
3. **Draft Updates**:
   - Update `Architecture & Implementation` to reflect current service interactions.
   - Update `The Patterns (The State)` section with direct links to all relevant ADRs.
   - **Badging**: Injected a "Documentation Health" badge into the README header.
   - **Versioning**: Apply the semantic bump according to [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md).
   - Update `Future Road` based on known technical debt and the "Evolving Wisdom" targets.
4. **Linkage Check**: Ensure all markdown links are correct and relative.
5. **Final Review**: Ask the user to accept the updated documentation.
