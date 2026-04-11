# DO Security Ideation: The Sovereign Shield 🛡️🏺✨

This document outlines the proposed security architecture for **Domain Objects (DO)** within the Never Played ecosystem. It aims to unify Identity, Persistence, and Authorization into a deterministic **Sovereign Shield**.

## 1. Persistence Stewardship (The "Where") 🧱

To maintain "Archival Sovereignty," we must control where data is physically written.

- **Declarative Routing**: Blueprints define their storage target in the `spec.yaml`:
  ```yaml
  persistence:
    tier: cloud | local | volatile  # Patterns 7 & 21
    scope: private | shared | realm # Realm isolation policy
  ```
- **Bucket Isolation**: The `PersistenceManager` utilizes these policies to route `realm.do.instances_*` keys to the correct physical backend (Firestore vs. LocalStorage).
- **Audit**: Every instance should carry a hidden `_routingPolicy` metadata field for observability.

## 2. Ownership Sovereignty (The "Who") 👤

We bridge the `SESSION_SERVICE` into the DO lifecycle to ensure every object has a traceable progenitor.

- **Progenitor Injection**: 
  - `ownerId`: The unique user ID from the Identity Provider.
  - `groupId`: The realm or team ID for shared access.
  - `scopeId`: The specific context (e.g., `customer_abc`) where the object was created (ADR-0025).
- **Auto-Injection**: The `DO-Registry` (or `UI-Factory`) automatically injects current session metadata into the `properties` map upon `instantiateDO`.

## 3. Guarded Interaction (The "How") 🗝️

We utilize the **Limes Service** to evaluate capability-based access at runtime.

### 📜 Blueprint Access (Design-Time)
- **can-view-blueprint**: Who can see the blueprint in the Registry?
- **can-instantiate**: Who can launch the flow?
- **can-edit-blueprint**: Who can modify the spec (Institutional vs. User)?

### 🏛️ Instance Access (Runtime)
- **can-view-instance**:
  - `match(instance.ownerId === currentUser.id)`
  - `match(instance.groupId in currentUser.groups)`
- **can-modify-instance**: Stricter check (usually limited to `ownerId` or `realm-admin`).
- **can-liquidate**: Highest privilege level (Archival permission).

## 4. Convenient Execution & Audit 🕵️‍♂️🏮

Security must be "invisible but understandable."

- **The Sovereign CLI**:
  - `do:audit [id]`: Deep-dive into an instance's security context (Owner, Scope, Permissions).
  - `do:whoami`: Summarize current effective capabilities across all active realms.
- **UI Indicators**:
  - **Shield Icons**: Indicators for "Locked" (Private), "Group" (Shared), or "Crown" (Institutional) objects.
  - **Access Denied Micro-animations**: Provide clear feedback when a guard blocks an interaction.
- **Security Blueprints**: Centralize global DO security rules in a single institutional `spec.security.yaml` for system-wide auditing.

## 🏺 Proposed Patterns
- **Pattern 13: Identity-to-Object Binding** (Implicit Injection).
- **Pattern 14: Declarative Routing Handshake**.
- **Pattern 15: The Sovereign Scoping Policy** (Ownership-based Filtering).

---
**Vision**: *"Every Domain Object is a sovereign inhabitant, protected by a shield etched with its progenitor's name."* 🛡️🏮✨
