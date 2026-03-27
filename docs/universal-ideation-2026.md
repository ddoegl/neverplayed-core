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
_This document evolves the previous roadmap into a concrete implementation strategy for the Next Generation of Never Played._ 🛰️🏁🚀
