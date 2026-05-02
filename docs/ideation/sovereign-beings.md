# Ideation: Sovereign Being Architecture

## 1. Ontological Grounding: Information Hierarchy
This architecture implements the **Level 1: Identity** layer of the [Information Hierarchy](file:///Users/ddoegl/speckit/neverplayed/docs/information-hierarchy.md).

*   **The Being (Level 1 - Identity)**: The substrate-independent "essence" or semantic core. It is the anchor of goals, logic, and memories.
*   **The Registry (Level 4 - Surrogate)**: The functional interface through which an Identity materializes for management and governance purposes.
*   **The Session (Level 2 - Stratum)**: The active presence of an Identity in a specific runtime environment, identified by a **Session ID (SID)**.

---

## 2. Realm Proposal: The Habitat
While the `governance` realm provides the "Law" (Logic/Rules), we propose **"The Habitat"** as the "Life" (Semantic Home) where beings inhabit.

*   **Rationale**: Beings inhabit a **Habitat**. It is where they create **niches**, develop **ecosystems**, and evolve behaviors.
*   **Physics**: The Habitat uses "Biological/Behavioral" physics—focusing on homeostasis, growth, and resonant interactions rather than strict entropy or administrative filters.

---

## 3. The SID as a "Carrier of Surrogates"
We propose a decoupling of the **Session ID (SID)** from the **Being's Identity**, treating the SID as a **Carrier** that can materialize multiple surrogates.

### The SID-Surrogate Orthogonality
To exist as an active participant in a Stratum, an **Identity (Being)** must take on a **Session (SID)**. This SID acts as a universal carrier for various functional "masks" (Surrogates):

*   **Being (Identity)**: `rob-core` (The Level 1 Essence)
*   **Session (SID)**: `sid-rob` (The active Stratum Presence)
*   **Materializations (Surrogates)**: 
    *   `sid-rob/person`: Rob as a social human in the Habitat.
    *   `sid-rob/registry-admin`: Rob as an auditor/manager in Governance.

---

## 4. Walkthrough: The Rob Example

### Phase 1: Bootstrap (The System Key)
The system starts. The `AuthShield` establishes your root credentials: `tid` (tenant) and `uid` (user). You are currently a "System Actor" in the Core realm.

### Phase 2: Materialization as a Being (Identity Shift)
You perform a **Stratum Jump** to the **Habitat** realm. You activate the **Being "rob"**. Your active **SID** now carries the identity context of "rob". You have now "inhabited" the Habitat.

### Phase 3: Dual-Surrogate Activation
While living in the Habitat as a `person` (Surrogate A), you also wish to manage the system. You "log in" to the `registry-admin` surrogate (Surrogate B).
*   Your SID now carries **both masks** simultaneously.
*   **Surrogate A (Person)** is registered in the Habitat ecosystem.
*   **Surrogate B (Admin)** is registered with the `Person Registry` in the **Governance** realm.

### Phase 4: Cross-Realm Interaction
Another being in the Habitat sends a "Registration Request" to Rob.
1.  The request is addressed to your **Person Surrogate** in the Habitat.
2.  You (as the Being "rob") process this request using your **Registry Admin Surrogate**.
3.  The Admin Surrogate writes the official record to the `Person Registry` (Governance).
4.  The `PersistenceResolver` performs a **Semantic Shunt**—the governance record is stored in the Governance cloud tier, while your social acknowledgement remains in the Habitat.

---

## 5. Technical Mechanism: Sovereign Routing

### 1. The Strategic Briefing
During boot, a Registry briefs the `PersistenceResolver` on the **Home Realm** of its target type.

```javascript
// Briefing the Oracle: Grounding Beings in the Habitat
resolver.registerPolicy('org.neverplayed.beings/person/', {
    realm: 'org.neverplayed.realm.habitat', 
    tier: 'cloud' 
});
```

### 2. Context Shunting
The `PersistenceSelector` (Level 2) manages the gap between the SID's current realm and the Being's home realm.

---

## 6. Roadmap & Refinement
1.  [ ] **Rename `org.neverplayed.realm.community` to `org.neverplayed.realm.habitat`**.
2.  [ ] **Refactor `session-service`** to support the "SID as Carrier" pattern with namespaced surrogates.
3.  [ ] **Implement `BeingService`** as a Level 2 bridge for identity discovery.
