# ADR-0167: The Sovereign Prism (Dual-Perspective Sovereignty)

## Status
Proposed

## Context
Previous architectural iterations debated between **Identity-Centric Idealism** (World as projection) and **Environment-Centric Realism** (Identity as resident). Under ADR-0165, we siloed by identity; under the proposed ADR-0166, we moved to an environment-first model. 

However, a truly sovereign system must allow the **Tenant** (the core generative model) to take on both stances:
1.  **Environment Realism (God-View)**: Seeing the universe as "Foundational Soil," governing its residents through objective physics.
2.  **Cognitive Idealism (Participant-View)**: Residing within an identity, perceiving and acting only through the cognitive lightcone and capabilities of that surrogate.

## Decision
We will implement the **"Sovereign Prism"** architecture, establishing both perspectives as valid projections of the system's multidimensional state:

1.  **Canonical Ground Truth (Persistence)**: We adopt **Environment Realism** as the foundational sharding strategy for storage: `np:v1:tenant:realm:identity:key`. This ensures stigmergic cohesion in the "Soil."
2.  **Dynamic Projection (Stratum Service)**: The `StratumService` will support a `perspective` toggle (`idealist` | `realist`). 
    -   **Realist Mode**: Vector projects as `np://tenant/realm/identity`.
    -   **Idealist Mode**: Vector projects as `np://tenant/identity/realm`, reflecting the observer's cognitive priority.
3.  **Aperture Filtering**: In **Idealist Mode**, the system should (in future) enforce "Perceptive Apertures," where an identity only sees the realm-traces allowed by its capabilities.

## Consequences

### Positive
-   **Ontological Flexibility**: The Tenant can oscillate between "God-View" forensics and "Resident-View" interaction.
-   **Stigmergic Grounding**: All data remains grouped by environment (Soil), making multi-agent interaction observable.
-   **Visual Fidelity**: The `StratumExplorer` can dynamically re-wire its topology to match the active perspective.

### Negative
-   **Migration Effort**: Requires updating all core services (`StratumCore`, `PersistenceSelector`, `SessionService`) that construct or parse the `np://` URI.
-   **Persistence Re-Pathing**: Existing stored data may require migration to the new hierarchical structure.

### Neutral
-   **URI Length**: The vector dimensions remain the same, only the sequence shifts.
-   **Tenant Root**: The Tenant remains the absolute root of the generative model.
