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
