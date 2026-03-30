# Authentication & Identity Architecture: The Dual-Layer Strategy 🛡️🎭

This document establishes the decoupled authentication and identity architecture for the Never Played ecosystem, ensuring a secure foundation for both human operators and autonomous AI agents.

## Core Multi-Layer Concept

The system employs a "Defense in Depth" strategy by separating technical system access from business-level persona identity.

---

### 1. Layer 1: System-Level Authentication (The Kernel Guard) 🛡️

This layer protects the core infrastructure, OSGi registry, and the production backplane. Without a valid Layer 1 identity, the system remains in a "Hardened Boot" state.

- **Purpose**: Guards access to the shell, configuration, bundle management, and persistence logs.
- **Provider**: **AuthShield Bundle** (`@neverplayed/auth-shield`).
- **Mechanism**: Firebase Google Authentication + OAuth2.
- **Identity Types**: 
  - **Core User**: A human developer or administrator.
  - **Core Agent**: A high-privilege AI agent (e.g., a "System Moderator") operating via MCP or Genkit.
- **Attributes (Limes-Managed)**:
  - `neverplayed-admin`: Full system control.
  - `neverplayed-developer`: Read-write access to code/config.
  - `neverplayed-observer`: Read-only registry visibility.
- **Capability**: `sys:auth`.

---

### 2. Layer 2: Domain-Level Identity (The Persona Layer) 🎭

This layer binds interactions to specific business actors (Personas) within the Never Played universe. 

- **Purpose**: Manages business permissions, flow state, and transactional authority.
- **Provider**: **Login Bundle** + **Person Registry** + **Session Service**.
- **Mechanism**: Persona selection + SCA Strategies (Strong Customer Authentication / Mocks).
- **Identity Types**:
  - **Persona User**: A human playing the game/sim (e.g., Robby, Daniela).
  - **Persona Agent**: A specialized AI agent acting *as* a persona (e.g., an automated moderator or a support assistant).
- **Capability**: `biz:persona`.

---

## 3. The Impersonation Workflow

A typical session involves a transition from the Kernel identity to a Persona identity:

1.  **Secure Boot**: `barebones-secure.html` initializes.
2.  **Kernel Auth (Layer 1)**: User/Agent logs in via AuthShield.
3.  **Shell Entry**: The OSGi registry becomes visible. The operator is now a **Core User/Agent**.
4.  **Persona Binding**: The operator "steps into" a persona from the **Person Registry**.
5.  **Domain Interaction**: The system now treats all subsequent flow actions as being performed by the **Persona** (Layer 2).

---

## 4. Agentic Implications

| Agent Type | Layer | Capabilities | Use Case |
| :--- | :--- | :--- | :--- |
| **System Agent** | 1 | `sys:*` | Automated system patching, log auditing, kernel-level moderation. |
| **Flow Agent** | 2 | `biz:*`, `flow:*` | Automated gameplay, business process automation (e.g., "Robby invites a friend"). |
| **Hybrid Agent** | 1+2 | **Full Surface** | Advanced autonomous operations (e.g., scaling the system while also playing the game). |

---

## 5. Interaction with Plexus & Limes 🧠🍋

The two layers interact via the **"Identity Handshake"** sequence:

### Layer 1: The Bootstrap Guard
- **Mechanism**: **Limes (System Instance)**.
- **Logic**: Before the full system (Plexus) is even initialized, a barebones version of Limes acts as a gatekeeper for the `sys:*` capability surface.
- **Check**: Valid `AuthShield` token + `neverplayed-admin` attribute.

### Layer 2: The Identity Tier
- **Mechanism**: **Plexus Engine**.
- **Logic**: Once technical access is granted, Plexus takes over as the "Big Brain." It ingests the selected **Persona**, **License**, and **Business Rules** to derive a dense Set of Capabilities (the AST).
- **Check**: Bitmask matching against the `Person Registry`.

### The Guarding Tier (Cross-Layer)
- **Mechanism**: **Limes (Domain Instance)**.
- **Logic**: Sits on top of Plexus output. It takes the "What you are" (Plexus AST) and matches it against "What you want to do" (Resource Context).

---

## 6. Alignment with Existing Mechanisms

This architecture formalizes and hardens the existing opportunistic patterns found in our domain bundles:

- **Person Registry Sync**: The `Login Bundle` remains the entry point for Layer 2, but it now yields to the `AuthShield` for Layer 1.
- **Plexus Evaluator**: Continues to be the source of truth for "Business Function" derivation, but is now shielded by the Kernel Guard.
- **SCA Strategies**: Remain as the "Proof of Persona" (Layer 2) but can optionally be triggered by Layer 1 for high-risk system operations.

---

## 7. Next Steps: Limes Hardening

To enforce this architecture, we will implement the following:

- **Service Guards**: Intercept core service calls (Logger, ConfigAdmin, Reset) to check for a valid Layer 1 token.
- **Attribute Enforcement**: Integrate **Limes** directly into the `barebones` boot sequence to verify the `neverplayed-admin` attribute before exposing the shell.
- **Agent Registry**: Formalize the registration of `Core Agents` in the same way we manage `Personas`.
