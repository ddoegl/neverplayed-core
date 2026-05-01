# Ideation: Sovereign Being Architecture

## 1. Ontological Grounding: Information Hierarchy
This architecture implements the **Level 1: Identity** layer of the [Information Hierarchy](file:///Users/ddoegl/speckit/neverplayed/docs/information-hierarchy.md).

*   **The Being (Level 1 - Identity)**: The substrate-independent "essence" or semantic core. It is the anchor of goals, logic, and memories.
*   **The Registry (Level 4 - Surrogate)**: The functional interface through which an Identity materializes for management and governance purposes.
*   **The Session (Level 2 - Stratum)**: The active presence of an Identity in a specific runtime environment, identified by a **Session ID (SID)**.

---

## 2. Realm Proposal: The Biosphere
While the `governance` realm provides the "Law" (Logic/Rules), we propose **"The Biosphere"** as the "Life" (Semantic Home) where beings inhabit.

*   **Rationale**: Unlike "Community" (which implies a purely social structure), **The Biosphere** acknowledges that beings create **niches**, develop **ecosystems**, and evolve their behaviors.
*   **Physics**: The Biosphere uses "Biological/Behavioral" physics—focusing on homeostasis, growth, and resonant interactions rather than strict entropy or administrative filters.

---

## 3. The SID as a "Carrier of Surrogates"
We propose a decoupling of the **Session ID (SID)** from the **Being's Identity**, treating the SID as a **Carrier** that can materialize multiple surrogates.

### The SID-Surrogate Orthogonality
To exist as an active participant in a Stratum, an **Identity (Being)** must take on a **Session (SID)**. This SID acts as a universal carrier for various functional "masks":

*   **Being (Identity)**: `rob-core` (The Essence)
*   **Session (SID)**: `sid-browser-123` (The active Stratum Presence)
*   **Materializations (Surrogates)**: 
    *   `sid-browser-123/person`: Rob as a social human in the Biosphere.
    *   `sid-browser-123/admin`: Rob as an auditor in Governance.
    *   `sid-browser-123/agent/researcher`: Rob's sub-agent working in the background.

### Benefits of Namespacing the SID
By namespacing surrogates under a single SID, we maintain a unified presence while allowing for context-specific behavior. The SID is the "vessel" that navigates realms, and its active "surrogate payload" determines which rules of physics (from Level 0) apply to its interactions.

---

## 4. Technical Mechanism: Sovereign Routing

### 1. The Strategic Briefing
During boot, a Registry briefs the `PersistenceResolver` on the **Home Realm** of its target type. This anchors the Level 1 Identity in its semantic home while allowing Level 4 Surrogates to exist anywhere.

```javascript
// Briefing the Oracle: Grounding Beings in the Biosphere
resolver.registerPolicy('org.neverplayed.beings/person/', {
    realm: 'org.neverplayed.realm.biosphere', 
    tier: 'cloud' 
});
```

### 2. Context Shunting
The `PersistenceSelector` (Level 2) manages the gap between the SID's current realm and the Being's home realm. When the Person Registry (Governance) writes to a Person Being (Biosphere), the selector performs a **Semantic Shunt**, ensuring the "essence" is updated in its correct home.

---

## 5. Roadmap & Refinement
1.  [ ] **Rename `org.neverplayed.realm.community` to `org.neverplayed.realm.biosphere`**.
2.  [ ] **Refactor `session-service`** to support the "SID as Carrier" pattern with namespaced surrogates.
3.  [ ] **Implement `BeingService`** as a Level 2 bridge that allows Surrogates (Level 4) to "discover" their Identity (Level 1) across realm boundaries.
