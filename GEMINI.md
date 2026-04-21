# project constitution: Never Played

This document establishes the core principles and architectural guidelines for the Never Played project.

## Core Principles

### 1. Architectural Consistency
- **Rule**: Always check `docs/architecture-patterns.md` when implementing new functionality or debugging flawed logic. Adhere to the established reactive and OSGi patterns to ensure system stability.
- **No Magic Strings**: Prohibit hardcoded strings for bundle names, service interfaces, and configuration PIDs. Centralize all identifiers in `public/core-types.js` to ensure system-wide consistency and prevent race conditions. Note: `public/shared-types.js` is legacy and must be avoided.

### 2. Canonical Identity Standards
- **Entry Point Authority**: `public/realms-secure.html` is the only valid entry point for the Secure Realm. `public/index.html` is legacy and must not be used for feature development.
- **Type Registry Authority**: `public/core-types.js` is the single source of truth for all service and PID identifiers.

### 3. Reactive State Management
- Favor Alpine.js for UI reactivity.
- Use the `$watch` pattern for cross-context synchronization.
- Leverage `Alpine.effect` for automatic persistence via `PersistenceManager`.

### 3. Decoupling and Discovery
- Centralize all service IDs and flow identifiers in `osgi/shared-types.js`.
- Use lazy, on-demand service retrieval to handle OSGi race conditions.

### 4. Configuration over Code
- Prefer declarative YAML-based definitions for domain objects and UI flows.
- Use the `ui-factory` to render standardized components from specs.

#### 4.1 Schema Parsimony (Single Source of Truth)
- Always favor single-source-of-truth ordering via object keys (Lexical Key Ordering). 
- **Prohibit** redundant "Shadow Sequences" (e.g., `stepOrder` arrays) that duplicate structure and invite divergent drift.
- Blueprints must be lean; if an ordering can be derived from the map's key sequence, an external array is a violation.

### 5. Platform Safety and Rendering Scoping
- **Namespace Isolation**: Segregate platform infrastructure state from bundle-level logic. Use `Alpine.store('platform')` for core orchestration (e.g., `kernelReady`) and preserve the `shell` namespace (e.g., `Alpine.store('shell')`) for application/bundle-level data.
- **Robust Variable Resolution**: Use the global `$uifResolve` magic helper for all standardized UI components. Never rely on naked scope resolution for template variables to prevent mutation race conditions during asynchronous flows.
- **Atomic Rendering**: Always ensure the Alpine `x-data` attribute is firmly established on the DOM element *before* injecting child templates to guarantee consistent context binding and prevent "Resolution Amnesia."

### 6. Core Architectural Constraint
- **ADR Authority**: Before every task, the agent MUST scan `docs/adr/` to align with established decisions.
- **Compliance**: All code generation must strictly adhere to 'Accepted' ADRs.
- **Divergence Alert**: If a user request contradicts an ADR, do not execute immediately. Instead, pause and ask: "This request conflicts with ADR-XXXX. Should we follow the ADR, or should I draft a new ADR to supersede it?"

### 7. Metadata Integrity
- **Manifest Compliance**: All bundles must provide a `manifest.json` that strictly adheres to the standard defined in `docs/bundle-manifest-spec.md`.
- **BSN Alignment**: The directory name of a bundle MUST match its `Bundle-SymbolicName` exactly to prevent discovery "ghosting".
- **README Standard**: Every bundle MUST contain a `README.md` following the structure in `docs/bundle-readme-spec.md`, including "The Patterns" section for foundational layers.

### 8. Strict Type Integrity
- **Prohibit Explicit `any`**: The use of the `any` type is strictly prohibited in TypeScript files. Always prefer specific interfaces, generics, or `unknown` (with proper type guards). 
- **Handling During Implementation**: Type integrity must be addressed during the initial implementation phase, not as a post-hoc refactoring. Use minimal interfaces to bridge external dependencies if full typings are unavailable.
