# 🛡️ Session Service Bundle

The **Identity Purity Guardian** that manages reactive user state, scoped authorizations, and session persistence.

## 🏛️ Architecture & Implementation

- **Scoped Identities**: Supports the `scopedUsers` pattern, allowing the system to maintain different identities (Retail, Business, Guest) simultaneously.
- **Reactive Store**: Exposes a `SESSION_SERVICE` as a global Alpine.js store for UI-driven session awareness.
- **Identity Sink**: Uses an `Alpine.effect` to automatically persist session state while stripping sensitive metadata for guest accounts.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Reactive State Synchronization** (Pattern 1) and **Platform Namespace Isolation** (Pattern 3/ADR-0019).
- **[ADR-0012: Lifecycle Guards](../../docs/adr/0012-lifecycle-guards.md)**: Implements the "Identity Purity" guard that strips leached metadata from guest sessions.
- **[ADR-0019: Platform Namespace Isolation](../../docs/adr/0019-platform-namespace-isolation.md)**: Carefully segregates platform infrastructure state from application-level session data.
- **Mechanism**: On boot, the `SessionService` performs a mandatory sync with the `PersistenceSelector` to hydrate the previous session.

## 🚀 Future Road

- **Session Expansions**: Implement JWT-based token management for secure backend API calls.
- **Active Flow Tracker**: Improve the `activeFlowId` logic to handle automatic scope switching during realm transitions.
