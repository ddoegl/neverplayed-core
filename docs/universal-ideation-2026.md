# Ideation: Universal "Mirror Stack" Architecture (2026) 🌌🕊️

## 1. Context & Evolution
Following the stabilization of the **Modular Shell (Phase 19)** and the introduction of the `BaseActivator` abstraction, we are now positioned to transition from a "Browser-Bound" system to a **Universal Mirror Stack**.

### Where We Stand
- **OSGi-like Maturity**: Bundles are decoupled, use dynamic discovery, and have a standard lifecycle.
- **Type Safety**: `core-types.js` provides a zero-dependency interface for services.
- **Configuration over Code**: We use manifest headers and `ConfigAdmin` for reactive behavior.

---

## 2. The "3-Tier Bundle" Pattern
To achieve headless compatibility and server-side deployment, every bundle must transition from a flat file to a tiered structure:

### A. Core Logic (`logic.js`)
- **Pure JS/TS**: No DOM, no `window`, no `localStorage`.
- **Stateless/Isolated State**: Manages the "Domain" logic (e.g., evaluation, data transformation).
- **Testable**: Can be imported directly into Deno/Vitest for headless verification.

### B. Persistence Strategy (`persistence.js`)
- **Interface**: Implements a standard `PersistenceProvider` (get/set/query).
- **Strategies**:
  - `BrowserStrategy`: Wraps `localStorage` / `IndexedDB`.
  - `ServerStrategy`: Wraps `Firebase` / `PostgreSQL` / `REST API`.
  - `NullStrategy`: For stateless headless testing.

### C. OSGi Activator (`activator.js`)
- **Orchestrator**: Binds the Logic and Persistence to the Pandino runtime.
- **Dependency Injection**: Injects the appropriate Persistence Strategy based on the environment (detected via `globalThis`).
- **UI Registration**: Registers the `FLOW_SERVICE` or templates if a UI is present.

### D. Shared Strategy Pattern (Building on `LOCAL_STRATEGY`)
- **Proven Pattern**: We already use this in `backoffice-do-registry`, where `LOCAL_STRATEGY` abstracts persistence via `PersistenceManager`.
- **Evolved Goal**: Generalize this so *all* services (not just domain objects) use strategies for their state management.

---

## 3. Headless Mode & Test Harness 🏗️🧪
The "Headless Never Played" version will be a specialized Deno/Node.js bootloader that:
1.  **Ignores UI Bundles**: Loads only bundles marked as `Service` type.
2.  **Mocks the DOM**: Providing a `MockPersistenceManager` or `FilePersistenceManager`.
3.  **Automated Scenarios**: Runs `*.test.yaml` against the `MatcherEngine` or `ActionRegistry` in a high-speed loop.


---

## 4. Multi-Platform Deployment
By strictly separating Logic from UI, we enable the following distribution targets:

| Target | Persistence | runtime | UI Layer |
| :--- | :--- | :--- | :--- |
| **Browser (Current)** | LocalStorage | Browser | Alpine.js 🎭 |
| **Headless (CI/CD)** | Memory/Null | Deno / Node | None 😶‍🌫️ |
| **Cloud (Production)** | Firebase / SQL | Cloud Functions | Next.js / Static 🌐 |
| **Edge (Fast Auth)** | KV Store | Cloudflare/Vercel | None / API ⚡ |

---

## 5. Persistence Abstraction (The next step)
We need a `public/persistence-base.js` that defines:
```javascript
export interface PersistenceProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  query(filter: any): Promise<any[]>;
}
```
Bundles will use `this.persistence.get('keys')` instead of `localStorage.getItem('keys')`.

---

## 6. Strategic Milestones
1.  **Refactor `matcher-engine`**: Move core evaluation into a pure `logic.js`.
2.  **Standardize Persistence**: Implement the `PersistenceProvider` pattern in `BaseActivator`.
3.  **Headless Bootloader**: Create a `scripts/headless-boot.ts` to verify service registration in Deno.

---

## 7. Milestones & Audit Trail 🖋️🏛️

### [2026-03-27]- **v1.2.0-universal-alpha (Current)**:
  - ✨ `scripts/headless-boot.ts`: Deno-based bootloader with local bundle server.
  - 🧩 `osgi-base.js`: `isHeadless` detection (Deno vs Browser).
  - 🛠️ `shell-cli/activator.js`: Command logic extracted from UI scope.
  - ✅ **Verified**: Core services successfully register in headless Deno environment.
- **Service Discovery**: Standardized core service IDs in `core-types.js`.
- **Environmental Health**: Restored `index.html` and `barebones.html` with unified import maps.
- **v1.2.1-headless-fs (Milestone)**:
  - 🔥 `scripts/headless-boot-fs.ts`: Filesystem-native bootloader with **Hot Swap** support via `Deno.watchFs`.
  - 🎭 **Alpine Mocks**: Integrated to allow UI-dependent services (`shell-host`) to boot in headless mode.
  - 🏷️ **Standardized Service IDs**: Migrated all core services (Logger, ConfigAdmin, SystemReset) to namespaced `@neverplayed/` format.
  - ✅ **Verified**: Flawless registration and real-time reloading in Deno environment.
- **v1.3.0-interactive-cli (Milestone)**:
  - 🛰️ **Interactive Shell**: Integrated `node:readline` for history navigation (Up/Down) and line editing.
  - 📂 **Universal FS Resolution**: Refactored `/install` to resolve local relative paths against `deploymentRoot` for 100% parity with bootloader.
  - 🌉 **Dual-Bridge Reactivity**: Implemented architectural CustomEvents (`shell:sidebar-toggle`) for cross-context synchronization between CLI and Web UI.
  - 🔉 **Log Governance**: Refined default shell verbosity (`INFO` -> `DEBUG`) for a cleaner interactive experience.
  - ✅ **Verified**: Flawless sidebar toggling and bundle installation across Terminal and Barebones UI.
- **v1.3.1-robust-navigation (Milestone)**:
  - 🏗️ **3-Tier Restoration**: Successfully decoupled `@neverplayed/shell-cli` (Pure Service) from `@neverplayed/shell-cli-dom` (Web UI Adapter) to restore architectural purity.
  - 🛡️ **Alpine Robustness**: Eliminated "after of undefined" crashes by implementing **Unique Monotonic IDs** for every log entry and the **Isolate & Initialize** pattern (`x-ignore` + `Alpine.initTree`) for flow viewports.
  - 📉 **Navigation Guards**: Implemented **Focus Guards** (BSN checks) and **Listener Guards** (attribute-based) across `shell-host` and `config-admin` to prevent redundant DOM updates and event accumulation.
  - ✅ **Verified**: Flawless stability for high-volume commands like `/bundles` and perfectly smooth A -> B -> A navigation transitions in `barebones.html`.
- **Commit**: `feat: Universal Architecture Phase 34 - 3-Tier Restoration & Navigation Robustness`

---

