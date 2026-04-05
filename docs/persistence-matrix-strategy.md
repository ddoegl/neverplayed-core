# Persistence Matrix: Strategic Data Gravity 🌌💾

This document establishes the official strategy for state management and data persistence across the Never Played ecosystem. It defines the "Where" and "How" of data lifecycle management, balancing between **Cloud Power** and **Local Confidentiality**.

---

## 1. The Persistence Matrix

We categorize our persistence capabilities across four primary dimensions: **Memory**, **Web Storage**, **Local Filesystem**, and **Cloud Firestore**.

| Mode | Technology | Intent | Implementation | Polling |
| :--- | :--- | :--- | :--- | :--- |
| **`local-fs`** | `Deno.write` | Local Dev, Sync with CLI | `localstorage` PM + `fs-sync` | **Yes** (5s) |
| **`local-browser`** | `localStorage` | Pure Privacy, Browser-only | `localstorage` PM bundle | No |
| **`firebase`** | Firestore | Collaboration, Persistence | `persistence-firebase` bundle | No |
| **`memory`** | JS Map | Transient, Guest sessions | Selector's `_volatileStore` | No |

---

## 2. Strategic Selection: `env.json`

The system's "Data Gravity" is determined by the `persistence_mode` property in `public/env.json`. This is the single source of truth for the system's boot-time orchestration.

*   **`local-fs`**: Standard development mode. Synchronizes browser state with `./.neverplayed/state.json`.
*   **`local-browser`**: Air-gapped browser mode. No data leaves the browser.
*   **`firebase`**: Managed cloud mode for cross-device synchronization.
*   **`memory`**: Volatile guest mode. All metadata and configurations are lost on reload.

---

## 3. The Data Guardian: `PersistenceSelector`

The **Persistence Selector** acts as a Strategic Data Shunt (Rule 3: Decoupling). It tracks all available `PersistenceManager` services and routes data based on key prefixes.

### Routing Tiers:
- **`volatile`**: Targeted by `security.*`. Never leaves memory.
- **`local`**: Targeted by `realm.*`, `identities.*`. Persisted in the browser/disk.
- **`cloud`**: Targeted by `config.*` (in Firebase mode). Persisted in the cloud.

### Transparent Managed-Keys Handshake:
To satisfy the security requirements of standard persistence managers (like the LocalStorage PM) without hardcoding every possible PID, the Selector implements an **Automatic Key Registration** logic:
1.  **Intercept**: Before storing a new key, the Selector checks if the provider is "Managed."
2.  **Authorize**: If the key is new, it automatically updates the provider's `managed-keys` list.
3.  **Silence**: This eliminates "Unmanaged Key" warnings from the console.

---

## 4. Realm Layering & Persistence Influence

Following the **Institutional Architecture**, persistence is governed by the following hierarchy:

| Tier | Drive | Mode Influence |
| :--- | :--- | :--- |
| **0. Global** | Connectivity | Fallback to `local` if `firebase` is unreachable. |
| **1. System** | Infrastructure | Defined in `env.json` (`local-fs` vs. `memory`). |
| **2. Policy** | Security | Selector's `_policies` (e.g., `identities.*` pinned to `local`). |

### Safety by Default:
If no persistence bundle arrives, the system naturally degrades to the **Memory (`volatile`)** tier of the Persistence Selector. No data is lost during the session, but nothing is persisted to the device or cloud, maintaining maximum privacy in restricted environments.

---

## 5. Strategic Summary: Managed Gravity

The Never Played persistence architecture is built on the principle of **Managed Gravity**. 

*   **Gravity**: By default, data is drawn toward the **Local** or **Cloud** tiers for collaboration, but only if the environment is "Safe and Ready."
*   **Control**: The **Persistence Selector** ensures that data only moves between tiers according to strictly defined architectural policies, never via coincidence. 🏛️🌌✅
