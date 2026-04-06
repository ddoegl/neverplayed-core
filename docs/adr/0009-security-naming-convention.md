# 9. ENTITY_ACTION Security Naming Convention

Date: 2026-04-06

## Status

Accepted

## Context

Authorization strategies in Limes need a predictable naming convention to ensure surgical control and discoverability without ambiguity.

## Decision

Standardize the `ENTITY_ACTION` naming convention for all Limes strategies:
- Strategies must use an uppercase prefix for the entity, followed by an underscore and uppercase action.
- **Visibility**: `${ENTITY}_VIEW` (e.g., `CASE_VIEW`).
- **Actions**: `${ENTITY}_${ACTION}` (e.g., `PRODUCT_SIGN`).

## Consequences

*   **Predictability**: Development teams know exactly what strategy ID to register.
*   **Surgical Control**: Avoids "God Strategies" by separating visibility from specific actions.
*   **Consistency**: Simplifies automation and management UIs.
