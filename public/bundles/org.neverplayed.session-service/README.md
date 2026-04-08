# 🛡️ Session Service Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


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

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
