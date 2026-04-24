# Stratum: Multi-Dimensional Contextual Architecture

## 1. The Core Concept (Revised)

A **Stratum** is a cross-section of the system's multidimensional search space. It represents the binding of specific **Facets** (concerns or aspects) to form a **Bounded Context** at a given point in time.

### The Anatomy of Facets
Facets are the independent variables of the system. To keep the architecture coherent, we treat these facets as orthogonal (independent) dimensions:

| Dimension | Facet Type | Examples | Current Implementation |
| :--- | :--- | :--- | :--- |
| **WHO** | Identity | Tenants (UID), Session Users (SID) | `Session Service` + `Identity Sharding` |
| **WHERE** | Realm | Worlds (Core, Foundation), Flows (Retail, Business) | `Realm Manager` + `Flow Registry` |
| **WHAT** | Domain | Specs (Blueprints), DO Instances, Bundles | `DO Registry` + `Persistence Manager` |
| **HOW** | Strategy | Persistence Tiers, Security Policies, AI Personas | `Persistence Selector` + `GEMINI Config` |

### The Bounded Context
A **Bounded Context** is the unique intersection of a selection from each facet. 
*Example:* `[Tenant: Daniela] ∩ [Identity: Admin] ∩ [Realm: Core] ∩ [Strategy: Cloud Persistence]`

---

## 2. Derivation: Achieving Strata with Existing Instrumentation

We have already built the foundations of this architecture through our recent work on **Sovereign Vaulting**.

### A. Contextual Anchoring (The WHO + HOW intersection)
Our current `np:v1:${tenant}:${identity}:${key}` sharding is the first physical implementation of a Stratum. It successfully binds the **Identity Facet** to the **Persistence Strategy Facet**.

### B. Realm Transition (The WHERE + WHAT intersection)
The `Realm Manager` already performs "Surge & Purge" operations. This is essentially shifting the **Realm Facet** and recalculating the **Bundle/Domain Facet** intersection to ensure only the relevant "World" is active.

### C. The Agent as the Orchestrator
The `Session Service` acts as the "Global Register" where the Agent (Human or AI) signals a facet shift (e.g., via `/login` or `/realm switch`). The reactive nature of our Alpine-based Layer 1 ensures that a shift in one facet (Identity) automatically triggers a shift in others (Persistence Context).

---

## 4. Facet Topology: Influence and Interference

Facets are not just static dimensions; they have a topology that determines how they bleed into one another.

### A. Vertical Influence (Inheritance / Shadows)
When a realm (e.g., `Foundation`) inherits from another (`Core`), it creates a **Stratum Shadow**.
*   **The Phenomenon**: Constraints defined in the parent realm are "immutable" for the child. 
*   **Implementation**: Inherited bundles in the `Realm Manager` are marked as "Sticky" during a switch. They provide the infrastructural "Gravity" that the child realm relies on.

### B. Lateral Coexistence (Peer Intersections)
Realms of the same layer can exist laterally. 
*   **The Phenomenon**: Two bounded contexts share the same **Tenant** but have different **Identities** or **Strategies**.
*   **Challenge**: How do we prevent state collision? 
*   **Solution**: **Namespace Sharding**. The `np:v1:${tenant}:${identity}:${realm}:*` key structure ensures that lateral realms remain "Blind" to each other unless explicitly bridged via a `Cross-Stratum Tunnel`.

### C. Identity Span (Mobility vs. Locality)
Identities have different "Spans" across the Stratum space:
*   **Scoped Identity (Local)**: A user identity that only exists within a specific Realm (e.g., a "Guest" in the Foundation realm).
*   **Sovereign Identity (Global)**: An identity that spans multiple Realms (e.g., "Daniela" as a global admin). 
*   **The Phenomenon**: A Sovereign Identity carries "State Luggage" across realms, while a Scoped Identity is "born and dies" within its Stratum.

---

## 5. Agent Dynamics: Reflexivity and Authority

The Agent (Human or AI) is not an external force; they are a participant within the system's topology.

### A. The Observer-Actor Duality (Residency)
An Agent interacts with a Stratum through the identities they control. 
*   **As Observer**: The Agent only sees the facets that their current Identity is "cleared" to perceive. The identity is a Lens that filters reality.
*   **As Actor**: Every action taken by the Agent (e.g., changing a spec, switching a realm) alters the environment. 
*   **Reflexivity**: Because the Agent's action changes the environment they are observing, they are **Resident** within the Stratum. They are part of the very context they are orchestrating.

### B. Sovereign Authority (Facet Ownership)
Identities are not just labels; they represent "The Power Over" the system's dimensions.
*   **Facet Gravity**: Some identities (e.g., `neverplayed-admin`) have the authority to pivot entire facets (switch Realms, purge Bundles). 
*   **Ownership**: An Identity "owns" a facet when its constraints are the **final authority** for that dimension. 
*   **The Phenomenon**: At any given state, the system is a negotiation between the Agent's intent and the Authority of their active Identity. If an Identity lacks "Power Over" the Realm facet, that Agent remains trapped in their current Stratum regardless of their intent.

---

## 6. Identified Gaps (The Path to Full Contextual Sovereignty)

To reach the goal of a fully "graspable and navigable" Stratum architecture, we must close the following gaps:

### Gap 1: Facet Observability (The "Where am I?" Problem)
While the logs show shifts, the UI does not yet visually represent the "Stratum" you are currently in. 
*   **Gap**: No unified "Context Dashboard" that shows the active intersection of [Tenant / Identity / Realm / Tier].
*   **Need**: A `Stratum Inspector` component.

### Gap 2: Cross-Facet Constraints (Deterministic Combining)
Currently, a user can technically switch to a "Cloud" tier even if the "Realm" requires "Local-Only" sovereignty.
*   **Gap**: Facets are combined ad-hoc. There is no formal "Constraint Matrix" to prevent illegal Stratum combinations.
*   **Need**: A `Stratum Validator` within the `Atomic Orchestrator`.

### Gap 3: Domain Object Tier Affinity (The Semantic Gap)
We have `PersistenceSelector` routing based on key prefixes, but the **DO Registry** doesn't yet fully "know" which Stratum a specific instance belongs to until it tries to save it.
*   **Gap**: Instances lack a "Stratum Stamp."
*   **Need**: Metadata on `DomainObject` instances that explicitly links them to the [Tenant:Identity:Realm] triplet.

### Gap 4: Navigation Sovereignty
Switching a Realm (`/realm switch`) is a heavy operation. Switching an Identity (`/login`) is a context shift. 
*   **Gap**: We lack a "Linkable Context URI" (e.g., `np://tenant/identity/realm/flow`) that allows an agent to jump to a specific Stratum instantly.
*   **Need**: Implementing `Stratum URI` support in the `Shell CLI`.

---

## 4. Proposed Evolution
1.  **Phase 1**: Implement the `Stratum Inspector` (UI visibility).
2.  **Phase 2**: Formalize the `Stratum URI` for fast navigation.
3.  **Phase 3**: Enforce `Facet Constraints` to ensure deterministic system behavior.
