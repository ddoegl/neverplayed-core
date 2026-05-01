## Governance, Metadata & Integrity

- **Manifest Compliance**: All bundles must provide a `manifest.json` that strictly adheres to the standard defined in `docs/bundle-manifest-spec.md`.
- **BSN Alignment**: The directory name of a bundle MUST match its `Bundle-SymbolicName` exactly.
- **README Standard**: Every bundle MUST contain a `README.md` following the structure in `docs/bundle-readme-spec.md`, including "The Patterns" section.
- **Strict Type Integrity**: 
  - **Prohibit Explicit `any`**: The use of the `any` type is strictly prohibited in TypeScript files.
  - **Minimal Interfaces**: Use minimal interfaces to bridge external dependencies if full typings are unavailable.
  - **Addressing Type Integrity**: Addressing type integrity must happen during the initial implementation phase, not as a post-hoc refactoring.
