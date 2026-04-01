# Ideation: The Never Played Realm Framework (NPRF) 🛡️🏛️🚀

This document defines the modular, layered architecture for "Realms" in the Never Played ecosystem. A Realm is a **Coherent Semantic Universe** that groups bundles, ontological concepts, and specialized AI residents into a localized context.

## 1. The Core Philosophy

### Authenticated Humans are Primary Citizens
Never Played is designed by and for humans. All infrastructure (Auth, Persistence, Security) exists to serve and protect the intent of the human user. Agents are **Inhabitants**—gradual additions that populate realms to perform specialized activities, but they always operate under human oversight.

### Co-Inhabiting in Small Steps
Transitioning a realm to an "Agent-Ready" state is a incremental process:
1. **Layer 1 (Invisible)**: Infrastructure is hardened and standardized.
2. **Layer 2 (Observational)**: Agents observe human activity through logs and event-stream telemetry.
3. **Layer 3 (Advisory)**: Agents provide suggestions via background notifications or "Proactive Strategy" recommendations.
4. **Layer 4 (Actionary)**: Agents are granted scoped execution rights within their specific realm via Limes authorization.

---

## 2. The 4-Layer Hierarchy

Realms are built using a layered stack, with each layer inheriting the ontological concepts of those beneath it.

### Layer 1: Foundation (Core Infrastructure)
- **Bundles**: Auth-Shield, Persistence-Selector, System-Logger, Limes.
- **Concepts**: Identity, Universal Persistence, Strategic Security.
- **Residents**: The System Overseer (Agent).

### Layer 2: Ontology (Real Life Concepts)
- **Bundles**: Space-Time Context, Person-Registry, Company-Metadata.
- **Concepts**: Shared physical reality, legal identities, temporal transitions.
- **Residents**: The Librarian (Registration Agent).

### Layer 3: Capabilities (Enabling Layers)
- **Bundles**: Email Provider, Notification Mesh, Communication Protocols.
- **Concepts**: Connectivity, asynchronous messaging, signal persistence.
- **Residents**: The Postmaster (Message Agent).

### Layer 4: Specialized Realms (Applications)
- **Example Realms**:
    - **Backoffice**: Administrative logic, Limes management, Registry editing.
    - **Business Portal**: B2B case management, Customer onboarding.
    - **Retail Experience**: Mobile app flows, Promotion engines, Personal dashboards.
- **Residents**: Specialized Personas (e.g., "Daniela-Mode" for Admin operations).

---

## 3. Realm Technical Definition

### The Realm Manifest (`realm-manifest.json`)
Realms are orchestrating using a declarative manifest that the `RealmManager` resolves at runtime.

```json
{
  "id": "org.neverplayed.realm.backoffice",
  "title": "Administrative Backoffice",
  "extends": ["org.neverplayed.realm.real-life"],
  "bundles": [
    "./bundles/org.neverplayed.limes-ui/manifest.json",
    "./bundles/system-services/backoffice-do-registry/manifest.json"
  ],
  "personas": [
    { "id": "admin-sentry", "role": "Oversight", "strategy": "AUDIT_VIEW" }
  ]
}
```

### The "Hot Swap" Context Switch
When a user switches between realms (e.g., from personal "Dashboard" to "Company Backoffice"):
- **Continuity**: Core services (Auth, Persistence) remain active.
- **Filtering**: The Shell UI filters visibility based on current Realm.
- **Ontology Swap**: Limes switch context keys, and specialized services are "Activated" via the `onActivate` hook.

---

## 5. Bring Your Own Realm (The "Plug-and-Play" Registry)

The long-term vision for Never Played is **Decentralized Inhabitancy**. Users and developers should be able to "Bring Your Own Realm" (BYOR) from any trusted source.

### 1. Dynamic Remote Registration
The `RealmManager` will support a `registerRemoteRealm(url)` method.
- **Manifest Fetching**: The manager fetches a `realm-manifest.json` from a remote server.
- **Resource Bundling**: The manifest points to bundles hosted either locally or on the originating realm-server.
- **Late-Binding Ontology**: Remote realms can provide their own specialized strategic types and Limes definitions.

### 2. The "Realm Bridge" (Cross-Reality Interaction)
Realms from different sources can interact via a standardized OSGi service bridge.
- **Example**: A "Financial Realm" from Server A can request an "Identity Verification" from the "Real Life Realm" on Server B.

### 3. Security & Trust (The Limes Sandbox)
Since a BYOR bundle could execute code, a strict security framework is required:
- **Manifest Signing**: Realms should be cryptographically signed by their provider.
- **Capability Scoping**: Remote realms are restricted by the `Shell-Host` (via Limes) to only access the core services they are explicitly granted.
- **User Permission**: The human citizen must "Invite" a realm into their shell, explicitly acknowledging the bundles it will install.

### 4. Use Case: The "Professional Persona"
A company provider hosts a specific "Professional Realm." A human citizen "loads" this realm into their private Never Played shell. The shell dynamically installs the company's specialized bundles (e.g., Internal CRM, Specialist Chat Agents), and the user can seamlessly transition to their "Work Identity" without ever leaving their personal digital twin.

---

## 4. Realm Residency Model

Agents do not have "God Mode." They **Inhabit** specific realms.
- **Locality**: An agent inside the "Communication Realm" cannot see or modify data in the "Financial Realm" unless a cross-realm bridge exists.
- **Ontology Awareness**: Agent prompts are enriched with the "Realm Context," allowing them to understand the specific semantics and domain objects of their inhabitancy.
