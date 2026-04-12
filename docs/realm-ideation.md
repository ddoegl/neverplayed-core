# Ideation: The Never Played Realm Framework (NPRF) 🛡️🏛️🚀

This document defines the modular, layered architecture for "Realms" in the
Never Played ecosystem. A Realm is a **Coherent Semantic Universe** that groups
bundles, ontological concepts, and specialized AI residents into a localized
context.

## 1. The Core Philosophy

### Authenticated Humans are Primary Citizens

Never Played is designed by and for humans. All infrastructure (Auth,
Persistence, Security) exists to serve and protect the intent of the human user.
Agents are **Inhabitants**—gradual additions that populate realms to perform
specialized activities, but they always operate under human oversight.

### Co-Inhabiting in Small Steps

Transitioning a realm to an "Agent-Ready" state is a incremental process:

1. **Layer 1 (Invisible)**: Infrastructure is hardened and standardized.
2. **Layer 2 (Observational)**: Agents observe human activity through logs and
   event-stream telemetry.
3. **Layer 3 (Advisory)**: Agents provide suggestions via background
   notifications or "Proactive Strategy" recommendations.
4. **Layer 4 (Actionary)**: Agents are granted scoped execution rights within
   their specific realm via Limes authorization.

---

## 2. The 5-Layer Ontology

Realms are built using a layered hierarchy. Each layer inherits the semantic
concepts of those beneath it, allowing for a strictly modular and reproducible
universe.

| Layer               | Type                | Responsibility                                     | Key Bundles                                                                                                                      |
| :------------------ | :------------------ | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| **L0: Runtime**     | **Nucleus**         | Deno/Browser, Pandino Kernel                       | `pandino`, `osgi-base`                                                                                                           |
| **L1: Core Shell**  | **Infrastructural** | Auth, Persistence, **Session**, YAML, **Shell UI** | `persistence-selector`, `auth-shield`, `session-service`, `limes`, `yaml-service`, `shell-host`, `shell-cli`, `config-admin`     |
| **L2: Foundation**  | **Semantic**        | Context, State, Execution, Actions, Messaging      | `selection-service`, `global-state`, `do-registry`, `action-registry`, `outreach`, `atomic-orchestrator`, `persistence-resolver` |
| **L3: Universe**    | **Ontological**     | Domain Concepts (People, Companies, Tenants)       | `real-life/dashboard`, `person-registry`, `company-registry`                                                                     |
| **L4: Application** | **Functional**      | Specialized business or retail logic               | `backoffice-licenses`, `retail-flows`, `invitations`                                                                             |
| **L6: Inhabitant**  | **Human-Sovereign** | Personal tools, manual overrides, Debug utilities  | `/install` command results, `manually-installed` set                                                                             |

### 👤 Layer 6: The Inhabitant Layer (Human Sovereignty)

The Inhabitant Layer represents the **Human Inhabitant's personal context**.
Unlike the lower 5 layers, which are defined by the universe, the Inhabitant
Layer is defined by **Sovereign Choice**.

- **Persistence**: These bundles are the "human's luggage." They travel between
  realms.
- **Priority**: If a realm manifest provides a conflicting bundle (same BSN),
  the **Universe wins** (ensuring semantic determinism), but the user-tooling is
  otherwise preserved.

---

## 3. Realm Technical Definition

### 🛠️ Service Responsibility Matrix

To maintain strict modularity, core services follow a "Reactive Downward Flow"
coordination pattern:

| Service          | Intent              | Responsibility                               | Layer | Coordination                                             |
| :--------------- | :------------------ | :------------------------------------------- | :---- | :------------------------------------------------------- |
| **Session**      | **Identity** (Who)  | Current User, Scoped Identity, Login/Logout  | L1    | **Source of Truth** for Identity.                        |
| **Selection**    | **Context** (What)  | Selected ID (License/Tenant/DO), Active View | L2    | Watches **Session**. Resets if user logs out.            |
| **Global State** | **Operation** (How) | UI Steppers, Layout, Flow State, Evaluation  | L2    | Watches **Selection**. Hydrates data on selection shift. |

---

---

---

## 3. Realm Technical Definition

### The Realm Manifest (`realm-manifest.json`)

Realms are orchestrating using a declarative manifest that the `RealmManager`
resolves at runtime.

```json
{
  "id": "org.neverplayed.realm.work",
  "title": "Universal Ontology (Work)",
  "extends": ["org.neverplayed.realm.foundation"],
  "description": "Layer 3: Work concepts and specialized persistence policies.",
  "privileges": {
    "realm-admins": ["daniel.doegl@doegl.info"]
  },
  "bundles": [
    "./bundles/org.neverplayed.work-dashboard/manifest.json"
  ],
  "domainObjects": [
    {
      "id": "visual-do-editor",
      "persistence": { "tier": "local", "enforce": true }
    },
    {
      "id": "atomic-showcase",
      "persistence": { "tier": "local", "enforce": true }
    }
  ]
}
```

### The "Hot Swap" Context Switch

When a user switches between realms (e.g., from personal "Dashboard" to "Company
Backoffice"):

- **Continuity**: Core services (Auth, Persistence) remain active.
- **Filtering**: The Shell UI filters visibility based on current Realm.
- **Ontology Swap**: Limes switch context keys, and specialized services are
  "Activated" via the `onActivate` hook.

---

## 5. Bring Your Own Realm (The "Plug-and-Play" Registry)

The long-term vision for Never Played is **Decentralized Inhabitancy**. Users
and developers should be able to "Bring Your Own Realm" (BYOR) from any trusted
source.

### 1. Dynamic Remote Registration

The `RealmManager` will support a `registerRemoteRealm(url)` method.

- **Manifest Fetching**: The manager fetches a `realm-manifest.json` from a
  remote server.
- **Resource Bundling**: The manifest points to bundles hosted either locally or
  on the originating realm-server.
- **Late-Binding Ontology**: Remote realms can provide their own specialized
  strategic types and Limes definitions.

### 2. The "Realm Bridge" (Cross-Reality Interaction)

Realms from different sources can interact via a standardized OSGi service
bridge.

- **Example**: A "Financial Realm" from Server A can request an "Identity
  Verification" from the "Real Life Realm" on Server B.

### 3. Security & Trust (The Limes Sandbox)

Since a BYOR bundle could execute code, a strict security framework is required:

- **Manifest Signing**: Realms should be cryptographically signed by their
  provider.
- **Capability Scoping**: Remote realms are restricted by the `Shell-Host` (via
  Limes) to only access the core services they are explicitly granted.
- **Human Sovereignty**: The citizen must "Invite" a realm into their shell,
  explicitly acknowledging the bundles it will install.

### 4. Use Case: The "Professional Persona"

A company provider hosts a specific "Professional Realm." A human citizen
"loads" this realm into their private Never Played shell. The shell dynamically
installs the company's specialized bundles (e.g., Internal CRM, Specialist Chat
Agents), and the user can seamlessly transition to their "Work Identity" without
ever leaving their personal digital twin.

---

## 4. Realm Residency Model

Agents do not have "God Mode." They **Inhabit** specific realms.

- **Locality**: An agent inside the "Communication Realm" cannot see or modify
  data in the "Financial Realm" unless a cross-realm bridge exists.
- **Ontology Awareness**: Agent prompts are enriched with the "Realm Context,"
  allowing them to understand the specific semantics and domain objects of their
  inhabitancy.

---

## 4. Realm Transition: The Context Hot-Swap

When a user or the system triggers a Realm Switch (e.g., via `/realm switch`),
the `RealmManager` orchestrates a multi-phase transition to align the OSGi
environment with the target universe's manifest.

### Phase 0: Environment Sync (The Provider Handshake)

Before any bundles are installed, the `RealmManager` resolves `public/env.json`.

- **Provider Injection**: Depending on the `persistence_mode` (e.g., `local-fs`
  vs `firebase`), the manager dynamically injects the appropriate persistence
  bundles into the the `core` realm.
- **Nucleus Alignment**: This ensures the "Source of Truth" for data is
  established before any service registration occurs.

### Phase 1: Synchronous Discovery (Index Handshake)

The manager fetches `realms/index.json` from the root context.

- **Recursive Resolution**: It resolves the recursive `extends` chain (e.g.,
  `work` -> `foundation` -> `core`).
- **The Boot Promise**: The manager exposes a `waitReady()` promise that only
  resolves once all discovered manifests are parsed and their registration
  promises (`_lock`) have cleared.

### Phase 2: Ontological Intersection

The manager aggregates all `domainObjects` defined across the layer stack.

- It notifies the **Domain Object Registry** to filter the visible universe.
- Blueprints not present in the "Ontological Horizon" of the realm are hidden
  from the UI and CLI.

### Phase 3: Layered Bundle Surge (The "Sticky" Reconciliation)

This is the most critical phase where the system's "bits and bytes" are aligned.
To prevent redundant restarts, the manager uses a **Sticky reconciliation
guard**.

1. **Identity Normalization**: The manager maps manifest BSNs (e.g.,
   `@neverplayed/shell-cli`) to their physical counterparts (e.g.,
   `org.neverplayed.shell-cli`) to ensure consistent identity matching.
2. **State Resilience**: Before initiating an install, the system checks if an
   identical bundle is already `ACTIVE` (handling both numeric `32` and string
   `"ACTIVE"` states).
3. **Surge Action**:
   - **STICKY**: If an identical bundle is active, it is skipped. This preserves
     its registered services and CLI commands.
   - **NEW**: If not found or in a lower state, it is installed and started
     incrementally.

### Phase 4: Privilege & Policy Injection (Identity Guard)

### Phase 4: Persistence Shunting (The Managed Gravity Model)

Persistence is governed by the **Data Guardian (Persistence Selector)**. Instead
of a single hardcoded database, the system uses a **5-Tier Shunting Engine**:

| Tier         | Persistence Mode | Intent                                                    |
| :----------- | :--------------- | :-------------------------------------------------------- |
| **Cloud**    | `firebase`       | Shared, high-availability, remote state.                  |
| **Local-FS** | `local-fs`       | Node-specific files (`state.json`), manual sync.          |
| **local**    | `local`          | High-performance, isolated browser storage.               |
| **Memory**   | `memory`         | Session-only, vanishes on reload (Standard for Security). |
| **Volatile** | `volatile`       | Ephemeral, non-persistent fallback.                       |

- **Managed Gravity**: Each Domain Object has a "Gravity" toward a specific
  tier.
- **Active Shunting**: In a "Work" realm, a `secure-note` might be shunted to
  `memory` by override, while in "Real Life," it stays in `local-fs`.
- **Wildcard Handshake**: The Selector automatically registers shunted keys with
  providers to prevent security warnings.

### Phase 5: Identity & Privilege Injection (Identity Guard)

- **Late-Join Identity Injection**: Because the `SessionService` may arrive
  asynchronously during a cold boot surge, the manager uses a **Phase-Aware
  Tracker**. If a realm is currently activating or already active when the
  session service arrives, the system injects realm-specific attributes (e.g.,
  `realm-admin`) directly into the `global` user scope.

### Phase 6: The "Talkative" Stepper & Healing Pass

Because context shifts are high-risk operations, the `RealmManager` provides an
**Interactive Stepper** mode (`--step` flag):

- **Milestones**: Resolves the plan and pauses for user review before applying
  the "Surge."
- **Healing Pass**: After activation, the manager re-registers its own CLI
  commands. This ensures that even if a core bundle (like the Shell CLI) was
  re-shuffled or restarted during the surge, the management tools remain
  correctly bound to the current shell environment.

---

## 6. The Unloading Strategy: Manifest-Driven Reconciliation

NPRF transitions use a **Surge Plan** to add capabilities and a **Purge
Protocol** to maintain context purity. To ensure determinism, we follow a
**Declarative Set-Based Reconciliation** strategy.

### 6.1 The Single Source of Truth

The target realm manifest (including its `extends` chain) is the absolute
definition of what bundles _should_ be active.

- **Explicit Inclusion**: If a bundle from another realm (e.g., `real-life`) is
  needed in the current realm (e.g., `work`), it must be explicitly listed in
  the target's `bundles` array.
- **Total Reconciliation**: Any bundle currently `ACTIVE` that is not part of
  the target manifest's tree is considered "Orphaned" and must be removed.

### 6.2 Reconciliation Set Logic

During a transition from `Realm A` to `Realm B`, the `RealmManager` performs the
following set operations:

| Set Operation        | Logic             | NPRF Phase | Result                                        |
| :------------------- | :---------------- | :--------- | :-------------------------------------------- |
| **Intersection**     | `Active ∩ Target` | **STICKY** | Bundles remain active. No flicker.            |
| **Difference (Add)** | `Target - Active` | **SURGE**  | New bundles are installed and started.        |
| **Difference (Rem)** | `Active - Target` | **PURGE**  | Orphaned bundles are stopped and uninstalled. |

### 6.3 Benefits of Explicit Composition

- **Determinism**: The framework state is reproducible from the manifest alone,
  regardless of the transition path.
- **Horizontal Isolation**: Switching from `real-life` to `work` automatically
  cleans up personal tools unless they are intentionally "Whitelisted" in the
  work manifest.
- **Semantic Purity**: Prevents "Ghost Services" and registry pollution from
  previous sessions.

### 6.4 The "Purge" Protocol (Phase 6 Implementation)

The future `RealmManager` cleanup phase will follow this lifecycle:

1. **Exclusion Sweep**: Management bundles (`realm-manager`, `shell-cli`) are
   marked as protected.
2. **Dependency-Aware Stop**: Orphaned bundles are stopped in reverse-order of
   their IDs (or discovery order) to prevent service lookup errors during
   shutdown.
3. **Registry Unbinding**: Bundles are uninstalled, clearing their registered
   services and CLI commands from the context.
