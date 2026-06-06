# 🧩 Shared UI Components
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)

The **Shared UI** bundle is the central registry for "Atomic" design components and the logic for the platform's standardized **UI Factory**. It provides the foundational UI rendering pipeline for all declarative flows.

## 🏛️ Architecture & Implementation

- **Atomic Component Registry**: Manages the mapping between logical component kinds (e.g., `command-button`, `master-detail`) and their underlying Custom Element tag names.
- **UI Factory Service**: Registers the `UI_FACTORY_SERVICE` to parse and render complex UI trees from declarative specifications.
- **Universal Action Registry**: Registers the `ACTION_SERVICE` to provide standardized, interactor-backed platform actions (e.g., `ui:alert`, `ui:confirm`).
- **Interactor Integration**: Tracks the `INTERACTOR_SERVICE` to ensure all UI notifications are environment-safe (CLI vs Browser).
- **Reactive Resolution Pipeline**: Implements the **Non-Destructive Interpolation** strategy (ADR-0026) to support multi-pass variable resolution.

### Component Registration
New bundles can contribute UI components by registering with the `ATOMIC_COMPONENT_REGISTRY_SERVICE`:
```javascript
const registry = context.getService(context.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE));
registry.register('my-special-widget', 'org-neverplayed-widget');
```

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **UI Factory & Atomic Components** (Pattern 12).
- **[ADR-0025: Identity Injection](../../docs/adr/0025-identity-injection-id-tokens.md)**: Enforces unique IDs for UI parts to enable robust data binding.
- **[ADR-0026: Reactive Variable Resolution](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md)**: Implements the non-destructive resolution bridge.
- **[ADR-0027: Semantic Bundle Versioning](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)**: Governs the versioning lifecycle.
- **[ADR-0028: Tiered Bundle Testing Strategy](../../docs/adr/0028-tiered-bundle-testing-strategy.md)**: Defines testing standards.
- **[ADR-0029: Universal Interactor Service](../../docs/adr/0029-universal-interactor-service.md)**: Decouples platform logic from channel-specific UI side-effects.
- **[ADR-0030: Hybrid Action Architecture](../../docs/adr/0030-hybrid-action-handshake.md)**: Standardizes the handshake between interactive and silent logic.
- **[ADR-0031: Proactive Discovery Orchestration](../../docs/adr/0031-proactive-discovery-orchestration.md)**: Governs boot-time spec ingestion and visibility.

## 🚀 Future Road

- **Theming Engine**: Dynamic HSL color token injection for all registered atomic components.
- **Visual Spec Editor**: Integration with the `YAML_EDITOR_SERVICE` to build UI specs visually.
- **Automatic Part Sharding**: Logic to split large UI specs into lazily-loaded chunks.


### Referenced Constants:
- `UI_COMPONENTS_SERVICE`
- `UI_REGISTRY_SERVICE`
- `LOG_SERVICE`
