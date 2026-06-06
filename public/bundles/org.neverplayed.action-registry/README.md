# 🛡️ Action Registry Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Central registry for **Actions** that can be performed on domain objects, enabling decentralized UI interactions and dynamic menus.

## 🏛️ Architecture & Implementation

- **Action Tracker**: Tracks services implementing the Action interface and maps them to domain object types.
- **Contextual Filtering**: Automatically filters available actions based on user privileges and domain context.
- **Unified Invocation**: Provides a single point to invoke actions without the caller needing to know the implementation details.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Resilient Service Retrieval** (Pattern 4) for tracking active Action services and **Constant Compliance** (ADR-0013) for identifier resolution.
- **[ADR-0004: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Uses the registry pattern to decouple the UI from specific business logic actions.

### The ENTITY_ACTION Convention
To ensure surgical authorization, all actions MUST follow the `ENTITY_ACTION` naming convention.
- **Example**: `CASE_SIGN`, `PRODUCT_TRADE`.
- **UI Integration**: The Registry automatically maps these to Limes strategies for visibility guarding.

## 🚀 Future Road

- **Undo/Redo Stack**: Integrated support for action history and transaction rollbacks.
- **Keyboard Shortcuts**: Map actions to system-wide keyboard shortcuts for power-users.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `ACTION_REGISTRY_SERVICE`
- `ACTION_SERVICE`
- `LOG_SERVICE`
