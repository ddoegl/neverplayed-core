# Strategic Plan: Agentic Inhabitation of Realms 🛰️🤖🎭

This document defines the integration strategy for AI agents within the **Never Played Realm Framework (NPRF)**, ensuring that agents act as specialized, realm-resident assistants rather than global system observers.

## 1. Core Principles: Human-First Co-Habitation

### Authenticated Humans are Primary Citizens
Never Played is a **Human-Centric Ecosystem**. 
- **Authority**: All final decisions and authorizations rest with the authenticated human user.
- **Privacy**: Agents only see data within the realms they are intentionally invited to inhabit.
- **Governance**: Every agentic action is logged and verifiable against the **Project Constitution**.

### Gradual Population (Small Steps)
Never Played realms are populated with agents in a phased approach:
1. **Passive Observation**: Agents analyze realm events and telemetry to understand ontological context.
2. **Advisory Assistance**: Agents offer prompts, suggestions, and "Proactive Strategies" to human users.
3. **Scoped Operation**: Agents are granted execution rights for specific realm-based services (e.g., "Postmaster" operations in the Communication Realm).

---

## 2. The Realm Residency Model

In a layered OSGi architecture, agents do not operate globally. They are **Scoped Residents** of a specific Realm.

### A. Realm-Aware Prompting
The `mcp-connector` injects the **Current Realm Manifesto** into the agent's context. This allows an agent inside the "Business Portal" to understand its specific semantics (Cases, Companies) without being distracted by "Real Life" or "Retail" concepts.

### B. Specialized Personas (Residents)
- **Layer 1 (The Overseer)**: Operates in the **Core Realm** across all infrastructure. Focuses on system health, backup integrity, and log auditing.
- **Layer 2 (The Librarian)**: Resides in the **Real Life Realm**. Assists with the "Person-Registry" and "Company-Metadata" synchronization.
- **Layer 3 (The Postmaster)**: Inhabits the **Communication Realm**. Manages email logs, notification priority, and signal routing.
- **Layer 4 (The Specialist)**: Inhabits specialized Application Realms (e.g., "Daniela-Mode" for **Backoffice** logic).

---

## 3. Architectural Bridge (Production Sync)

To enable co-habitation between browser users and headless agents, we utilize the **Digital Twin** synchronization model.

### A. The "Digital Twin" Mirror
The agent and the human user share a synchronized registry and state mirror.
- **Persistence Layer**: Cloud persistence (Firebase) ensures that when a human updates a case in the UI, the agent's headless "Real-Life" state is hydrated instantly.
- **Event Mesh**: `EventAdmin` topics are bridged between the browser and the agent's MCP environment, allowing for real-time reactive cooperation.

### B. The Command & Control Queue
Agents interact with human-led realms via a **Reactive Command Pipeline**:
1.  **Intent**: The agent writes a command to `/realms/{realmId}/commands`.
2.  **Limes Guard**: The `auth-shield` verifies the agent's residency and permission for the specific action.
3.  **Execution**: The OSGi registry (Browser or Headless) executes the logic and updates the command node with the result.
4.  **Observer**: The human user can see "Agent Activities" in their local system logger or task monitor.

---

## 4. Resilience & Security (Limes First)

Every agentic activity is governed by the same **Limes Authorization Matrix** as human activity.
- **Authentication**: Agents use specialized MCP Secrets or Custom Tokens issued by the `mcp-connector`.
- **Authorization**: Agents are assigned roles based on their **Realm Residency**. A "Postmaster" agent in the Communication Realm is explicitly denied access to the "Security Configuration" bundle in the Core Realm.

---

## 5. Implementation Roadmap (Small Steps)

1.  **Phase 1: Realm Manifests**: Define the initial universes (Core, Real Life).
2.  **Phase 2: Registry Observation**: Expose the OSGi `ServiceTracker` outputs to the Agent Context as a "World View."
3.  **Phase 3: Advisory Personas**: Launch the first "Librarian" agents to assist with data normalization in the Person-Registry.
4.  **Phase 4: Full Multi-Agent Resonance**: Cross-realm cooperation where the "Librarian" requests the "Postmaster" to send an invitation via the Communication Layer.

---
> [!IMPORTANT]
> **Co-Habitation Goal**: To build a system that feels "alive" with helpful residents, while ensuring the human user remains the ultimate sovereign of their digital twin.
