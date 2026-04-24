# 🛡️ Session Service Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Identity Purity Guardian** that manages reactive user state, scoped authorizations, and session persistence.

## 🏛️ Architecture & Implementation

- **Scoped Identities**: Supports the `scopedUsers` pattern, allowing the system to maintain different identities (Retail, Business, Guest) simultaneously.
- **Identity Hierarchy**: Implements **Sovereign Identity Scoping (ADR-0165)**, prioritizing `activeFlowId` over `activeRealmId` and defaulting to the `global` tenant anchor. 🛡️🪐
- **Forensic Auditing**: Features a **Mutation Forensic Guard** that monitors the reactive store for direct property assignments, providing a forensic trail for unauthorized state shifts.
- **Reactive Store**: Exposes a `SESSION_SERVICE` as a global Alpine.js store for UI-driven session awareness.
- **Identity Sink**: Uses an `Alpine.effect` to automatically persist session state while stripping sensitive metadata for guest accounts.
- **Payload Normalization**: Supports both high-fidelity (Firebase objects) and low-fidelity (CLI strings) identity inputs, promoting strings to standard user objects to ensure downstream compatibility (ADR-0140). 🛡️👤

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Reactive State Synchronization** (Pattern 1) and **Platform Namespace Isolation** (Pattern 3/ADR-0019).
- **[ADR-0165: Sovereign Identity Scoping](../../docs/adr/0165-sovereign-identity-scoping.md)**: Establishes the rule of **Hierarchical Sharding** and **Push-Synchronization** from the Realm Manager. 🛡️🪐
- **[ADR-0012: Lifecycle Guards](../../docs/adr/0012-lifecycle-guards.md)**: Implements the "Identity Purity" guard that strips leached metadata from guest sessions.
- **[ADR-0019: Platform Namespace Isolation](../../docs/adr/0019-platform-namespace-isolation.md)**: Carefully segregates platform infrastructure state from application-level session data.
- **Mechanism**: On boot, the `SessionService` performs a mandatory sync with the `PersistenceSelector` to hydrate the previous session.

## 🚀 Future Road

- **Stratum Inspector**: Implement a UI component that visualizes the current [Tenant/Identity/Realm] intersection.
- **Session Expansions**: Implement JWT-based token management for secure backend API calls.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
- [ADR-0140](../../docs/adr/0140-sovereign-shield.md) - Sovereign Shield (CLI Normalization). 🛡️👤
- [ADR-0165](../../docs/adr/0165-sovereign-identity-scoping.md) - Sovereign Identity Scoping (Hierarchical Sharding). 🛡️🪐
