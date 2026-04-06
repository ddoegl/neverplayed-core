# 13. Layered Architectural Constants via `core-types.js`

Date: 2026-04-06

## Status

Accepted

## Context

The previous approach (ADR 0001) used a single `public/shared-types.js` file for all architectural constants. As the system scales with multiple Realms (Core, Foundation, Universe, Application), a flat file structure becomes difficult to manage and doesn't support the "Bring Your Own Realm" (BYOR) philosophy where higher layers should be able to define their own ontological constants without modifying core infrastructure.

## Decision

Move to a layered and aggregated constants model centered around `public/core-types.js`.

1. **Aggregation**: `core-types.js` acts as a central aggregator that re-exports constants from specialized files (e.g., `./types/platform.js`, `./types/domain.js`).
2. **Layered Inclusion**:Constants are grouped by their ontological layer (Infra, Foundation, Domain).
3. **Extensibility**: Higher layers and custom Realms can bring in their own specialized constants by providing their own type files and potentially extending the global types registry.
4. **Transition**: Existing references to `shared-types.js` will be gradually migrated to imports from `core-types.js` or its underlying layer files.

## Consequences

*   **Scalability**: Supports the growth of the Never Played ecosystem by preventing a single "God File" for constants.
*   **Modular Ontologies**: Each realm layer can maintain its own semantic definitions.
*   **Clearer Boundaries**: Distinguishes between core platform infrastructure and domain-specific concepts.
*   **Decentralization**: Enables BYOR by allowing remote realms to provide their own constants aggregator.
