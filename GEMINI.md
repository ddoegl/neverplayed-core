# project constitution: Never Played

This document establishes the core principles and architectural guidelines for the Never Played project.

## Core Principles

### 1. Architectural Consistency
- **Rule**: Always check `docs/architecture-patterns.md` when implementing new functionality or debugging flawed logic. Adhere to the established reactive and OSGi patterns to ensure system stability.

### 2. Reactive State Management
- Favor Alpine.js for UI reactivity.
- Use the `$watch` pattern for cross-context synchronization.
- Leverage `Alpine.effect` for automatic persistence via `PersistenceManager`.

### 3. Decoupling and Discovery
- Centralize all service IDs and flow identifiers in `osgi/shared-types.js`.
- Use lazy, on-demand service retrieval to handle OSGi race conditions.

### 4. Configuration over Code
- Prefer declarative YAML-based definitions for domain objects and UI flows.
- Use the `ui-factory` to render standardized components from specs.
