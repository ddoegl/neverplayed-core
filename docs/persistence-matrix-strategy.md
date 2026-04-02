# Persistence Matrix: Strategic Data Gravity 🌌💾

This document establishes the official strategy for state management and data persistence across the Never Played ecosystem. It defines the "Where" and "How" of data lifecycle management, balancing between **Cloud Power** and **Local Confidentiality**.

---

## 1. The Persistence Matrix

We categorize our persistence capabilities across four primary dimensions: **Memory**, **Web Storage**, **Local Filesystem**, and **Cloud Firestore**.

| Mode | Technology | Best For | Security Profile | Network Req |
| :--- | :--- | :--- | :--- | :--- |
| **In-Memory** | JS Map/Variables | Transient state, caches | **Highest** (Volatile) | None (Offline) |
| **Local (Web)** | `localStorage` | Browsers, UI state | **Medium** (Unencrypted) | None (Offline) |
| **Local (Deno)** | `localStorage` | Headless CLI, Micro-agents | **Medium** (Isolated) | None (Offline) |
| **Local (FS)** | `Deno.write` | Local Dev, Config Twin | **High** (User-Owned) | None (Offline) |
| **Cloud** | Firebase Firestore | Cross-device, Persistence | **Standard** (Encrypted) | Reliable (Online) |
| **Twin Sync** | FS Sync Bundle | Syncing UI with Headless | **Hybrid** (Developer-Only) | Local (Offline) |

---

## 2. Context-Sensitive Selection

Choosing the right persistence mode is determined by **Gravity**, **Privacy**, and **Environment**.

### 🛠️ Static Selection (Configuration Time)
Defined in `public/env.json`. Use this for deployment-wide defaults.
*   **Production Cloud**: `persistence_mode: "firebase"` (Global sync).
*   **Local Workbench**: `persistence_mode: "local"` (Privacy first, offline dev).

### 🧠 Dynamic Adaptation (The Shunting Logic)

The goal is to move from a hardcoded choice to a **Context-Aware Shunt**. This logic determines the "Data Gravity" at runtime.

#### The Air-Gapped Shunting Flow:

1.  **Discovery Phase**: Upon boot, the `PersistenceSelector` queries the OSGi registry for all `PersistenceManager` implementations.
2.  **Environment Sensing**: 
    *   **Connectivity**: Does `persistence-firebase` report a "Ready" state?
    *   **Policy**: Does `env.json` or a local `.lock` file enforce an `internal-only` policy?
3.  **The Shunt Decision**:
    *   **Mode: SYNCED**: If Firebase is ready and Policy is "Global", data flows to Cloud Firestore. 
    *   **Mode: CACHED**: If Firebase is intermittent, data shunts to `localStorage` and cues up a "Sync-Pending" state.
    *   **Mode: AIR-GAPPED**: If Policy is "High-Security" or the environment is restricted, the Cloud bundle is bypassed entirely. Data is shunted to a **Deno-Only FS** or **Volatile Memory**.

---

## 3. Reflection: The `LOCAL_STRATEGY` Pattern

In our `backoffice-do-registry`, we utilize a default strategy known as **`LOCAL_STRATEGY`**. This acts as a critical architectural buffer for Domain Objects.

### How it operates:
*   **Default Behavior**: Any blueprint missing an explicit `strategyId` defaults to `LOCAL_STRATEGY`.
*   **Abstraction**: The registry doesn't know *where* `LOCAL_STRATEGY` stores its data. It simply tracks a service implementing `DOMAIN_STRATEGY_SERVICE`.
*   **The Shunt Integration**: When `LOCAL_STRATEGY` calls `pm.store()`, it triggers the `PersistenceManager` active in the environment.
    *   In an **Air-Gapped** setup, `LOCAL_STRATEGY` writes to the local Deno filesystem.
    *   In a **Synced** setup, it unknowingly writes to Firebase via the `persistence-firebase` provider.

### Why this is powerful:
It allows us to build **Universal Flows**. A "User Onboarding" flow can be designed once. Depending on which persistence bundles are started, the data either stays on the device (Privacy Mode) or travels to the cloud (Collaboration Mode), without changing a single line of business logic in the flow itself.

---

## 4. The Orchestration Layer: `PersistenceSelector`

To make these choices usable, we utilize the **OSGi Service Registry**. All persistence bundles must register the `PERSISTENCE_MANAGER_SERVICE`, but with specific **Service Properties**.

**Example: A bundle looking for "Local First" persistence:**
```javascript
const filter = "(&(objectClass=PersistenceManager)(capability=sys:persistence)(implementation=deno-fs))";
const ref = context.getServiceReferences(filter)[0];
```

### Proposed: The Persistence Guardian
We advocate for a `PersistenceSelector` bundle that acts as a **Proxy Service**:
*   It tracks all available `PersistenceManager` services.
*   It exposed its own `PersistenceManager` interface to the rest of the system.
*   It implements the logic to "shard" data:
    *   Key `identities/*` -> Write to **Local FS Only**.
    *   Key `config/*` -> Write to **Firebase** (if available).
    *   Key `ui/*` -> Write to **localStorage**.

---

## 4. Environment-Specific Guidelines

### 🖥️ Headless Deno Agents
Deno agents typically lack a UI and often operate in constrained environments.
*   **Standard**: Use `persistence-deno` (State stored in `./.neverplayed/state.json`).
*   **Hardened**: Use `persistence-deno-localstorage` for process-isolated storage that doesn't leak into the project directory.

### 🌐 Browser (Web)
*   **Anonymous Mode**: Standard `localStorage`.
*   **Authenticated Mode**: Firebase Firestore (enabling cross-device sync for multi-step flows).
*   **Development Twin**: `persistence-fs-sync` (The bridge between your browser and the Deno agent running in the terminal).

### 🔐 Sensitive Environments (Air-Gapped)
In high-security contexts, ensure the `persistence-firebase` bundle is **removed from the manifest**. The system will naturally degrade to `localStorage` or In-Memory without a code change, maintaining the **Safety by Default** principle.

---

## 5. The Hierarchy of Persistence Influence (Policy Stack)

Data gravity is determined through a layered priority stack, allowing for granular control across different actors and environments.

| Tier | Driver | Policy Source | Example |
| :--- | :--- | :--- | :--- |
| **0. Realm** | **Context** | `realm-manifest.json` | A "Confidential War Room" realm barring all Cloud sync. |
| **1. System** | Infrastructure | `env.json`, Deployment | Node-wide "Air-Gapped" vs. "Cloud-Synced" strategy. |
| **2. Bundle** | Developer | `manifest.json`, Activator | A "Secure Wallet" bundle enforcing `persistence.tier=local` for its payloads. |
| **3. Blueprint** | Designer | `spec.yaml:domainObject` | "Employee Records" blueprint defaulting to Cloud for collaboration. |
| **4. Instance** | User | `instance.persistenceSpec` | A specific "Personal Journal" instance pinned to Local storage by the user. |

### Decision Logic (The Highest Priority Wins)
If a **Realm (Tier 0)** enforces "Local-Only," it overrides all other participants including the user. If the Realm is permissive, the **Bundle (Tier 1)** or **User (Tier 4)** fallback logic applies.

---

## 6. Security Enforcement (The Limes Guardian) 🔐

In a "Persistence-Aware" architecture, **Limes** must move from being a simple UI guard to a **Policy Validator**:

*   **Authorized Gravity**: Before a strategy moves data to the Cloud, Limes must verify the user possesses the `sys:persistence-cloud` capability.
*   **Encrypted Tunnels**: High-tier persistence (Cloud/FS) must be governed by Limes-checked encryption keys provided via the identity session.
*   **Audit Logging**: Every "Gravity Shift" (moving data between tiers) must be logged as a security event.

---

## 7. Strategic Data Migration (Gravity Shifts) 🚀

As policies or user choices evolve, instances may need to "Shift Gravity" between persistence managers.

1.  **Promotion (Local ⮕ Cloud)**: An instance created offline in `localStorage` is moved to Firebase when a global "Sync All" policy is activated.
2.  **Demotion (Cloud ⮕ Local)**: For privacy reasons, a user "unplugs" a specific instance from the cloud, moving its payload to the local device and wiping the remote copy.
3.  **Wipe Logic**: Moving data **out** of a tier must always include a mandatory "Secure Wipe" of the source bucket to prevent data leaks.

---

## 8. Strategic Summary: Gravity & Control

The Never Played persistence architecture is built on the principle of **Managed Gravity**. 

*   **Gravity**: By default, data is drawn toward the **Cloud** for collaboration and persistence, but only if the environment is "Safe and Ready."
*   **Control**: Both the **Bundle** (via Security Tiers) and the **User** (via Privacy Toggles) can exert an "Anti-Gravity" force to keep data safely shunted locally.

This dual-layer approach ensures that as we build more complex **Universal Flows**, our security and privacy posture remains adaptive—never hardcoded, and always context-aware. 🏛️🌌✅
