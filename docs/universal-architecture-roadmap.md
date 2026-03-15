# Roadmap: Universal Decoupling & Multi-Platform Distribution 🌌🏗️

## 1. The "Big Bang" Decoupling

The core shift is the transition from "Feature Bundles" to a binary **Service
vs. UI** architectural model.

### Service Bundles (The Brain 🧠)

- **Responsibility**: Logic, Data Validation, Evaluation (Matcher Engine), and
  Persistence Orchestration.
- **Runtime**: Environment-agnostic (Browser, Deno, Node.js, Electron Main).
- **Communication**: Exposed via a standardized Service Interface (e.g.,
  `MatcherEngine.evaluate()`).

### UI Bundles (The Face 🎭)

- **Responsibility**: Rendering, User Interaction, and Styling (Alpine.js /
  Tailwind).
- **Runtime**: Browser-only (or WebView).
- **Communication**: Consumes Service Bundles via the OSGi-like Service
  Registry.

---

## 2. Persistence Abstraction: The "Universal Store" 🗄️

We move away from hardcoded `localStorage` toward a `PersistenceProvider`
interface.

- **Local Provider**: Wraps `localStorage` or `IndexedDB` for
  offline-first/browser use.
- **Server Provider**: Wraps **Firebase Firestore**, PostgreSQL, or MongoDB.
- **Strategy**: The bundle `activator` detects the environment and injects the
  appropriate provider.

---

## 3. Platform-Specific Deployment Scenarios

### 🔥 Firebase (Distributed Cloud)

- **Firebase Functions**: The **Service Bundles** (like `poc-evaluator`) run as
  Cloud Functions.
- **Firestore**: All YAML strategies and Registry data are stored as structured
  documents.
- **Hosting**: The **UI Bundles** are served via Firebase Hosting.
- **Benefit**: Unlimited scale and real-time synchronization across all users.

### ⚛️ Electron (Desktop Native)

- **Main Process**: Runs the **Service Bundles** (persistent logic, file system
  access).
- **Renderer Process**: Runs the **UI Bundles** in a Chromium window.
- **Benefit**: Best-in-class performance and access to hardware/file-system for
  local development tools.

### 📱 Native Mobile (Flutter / React Native)

- **The Bridge**: The JavaScript engine (V8/Hermes) runs the **Service Bundles**
  in the background.
- **Native UI**: Flutter or React Native provides the views, querying the
  JS-based services for permissions and data.
- **Benefit**: 100% logic parity between the Web dashboard and the iOS/Android
  app.

---

## 4. Multi-Distribution Topology

A single source code repository can now target multiple environments:

| Target               | Service Layer       | UI Layer           | Persistence        |
| :------------------- | :------------------ | :----------------- | :----------------- |
| **Prototyper (Now)** | Browser JS          | Alpine.js          | localStorage       |
| **Enterprise Cloud** | Firebase Functions  | Next.js / Alpine   | Firestore          |
| **Dev Tooling**      | Deno CLI / Electron | Electron View      | Local Files        |
| **Mobile App**       | Embedded JS Engine  | Flutter Components | SQLite / Firestore |

---

## 5. Strategic Benefits

1. **Headless Testing**: We can run the "Brain" of a bundle in a terminal to
   verify complex logic without rendering a single pixel.
2. **Shared Logic**: A bug fix in the `SegmentationEngine` is automatically
   deployed to the Web, Server, and Mobile app simultaneously.
3. **Flexible Sourcing**: High-security data can stay on-premise (local
   persistence), while public metadata lives in the cloud (Firebase).

---

## 6. Implementation Milestones

1. **Refactor `activator.js`**: Extract business logic into separate, pure-JS
   classes.
2. **Generic Persistence API**: Create a `PersistenceManager` that can be
   swapped at startup.
3. **Deno-Wrapper**: Verify a Service Bundle can start and run its logic inside
   Deno.

_This roadmap transforms the project from a browser experiment into a robust,
industrial-grade software ecosystem._ 🛰️🚀🏁
