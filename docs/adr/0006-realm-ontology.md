# 6. 5-Layer Realm Ontology

Date: 2026-04-06

## Status

Accepted

## Context

The system requires a strictly modular and reproducible structure for organizing bundles and ontological concepts into "Realms."

## Decision

Adopt a 5-layer hierarchical ontology for all Realms:
1. **L0 Runtime**: Core OS environment (Deno, Pandino Kernel).
2. **L1 Core Shell**: Infrastructure services (Auth, Persistence, Session).
3. **L2 Foundation**: Semantic services (Selection, Global State, Registries).
4. **L3 Universe**: Ontological domain concepts (People, Companies).
5. **L4 Application**: Functional business logic (Licenses, Retail).
6. **L6 Inhabitant**: Human-sovereign tools (Manual overrides, Debug utilities).

## Consequences

*   **Semantic Coherence**: Clear boundaries for responsibility across bundles.
*   **Layered Inheritance**: Realms can extend other realms, inheriting their ontological concepts.
*   **Human Sovereignty**: Distinct "Inhabitant" layer ensures user-installed tools travel between realms.
