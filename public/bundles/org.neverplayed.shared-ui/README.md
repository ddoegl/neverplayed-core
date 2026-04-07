# 🧩 Shared UI Components
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)

The **Shared UI** bundle is the central registry for "Atomic" design components and the logic for the platform's standardized **UI Factory**. It provides the foundational UI rendering pipeline for all declarative flows.

## 🏛️ Architecture & Implementation

- **Atomic Component Registry**: Manages the mapping between logical component kinds (e.g., `command-button`, `master-detail`) and their underlying Custom Element tag names.
- **UI Factory Service**: Provides a high-level service for creating complex UI trees from declarative JSON/YAML specifications.
- **Action Ingress**: Registers standard platform actions (e.g., `step.navigate`, `synthetic.client.summary-alert`) into the centralized `ActionRegistry`.
- **Reactive Resolution Pipeline**: Implements the **Non-Destructive Interpolation** strategy to support multi-pass variable resolution and late-binding asynchronous data.

### Component Registration
New bundles can contribute UI components by registering with the `ATOMIC_COMPONENT_REGISTRY_SERVICE`:
```javascript
const registry = context.getService(context.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE));
registry.register('my-special-widget', 'org-neverplayed-widget');
```

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **UI Factory & Atomic Components** (Pattern 12).
- **[ADR-0016: Inhabitant Layer Sovereignty](../../docs/adr/0016-inhabitant-layer-sovereignty.md)**: Governs the rendering scope of components within their host environments.
- **[ADR-0025: Identity Injection](../../docs/adr/0025-identity-injection-id-tokens.md)**: Enforces unique IDs for UI parts to enable robust data binding.
- **[ADR-0026: Reactive Variable Resolution](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md)**: Implements the non-destructive, reactive resolution bridge between UIFactory and Alpine.js.
- **[ADR-0027: Semantic Bundle Versioning](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)**: Governs the versioning lifecycle of this and all future bundles.

## 🚀 Future Road

- **Theming Engine**: Dynamic HSL color token injection for all registered atomic components.
- **Visual Spec Editor**: Integration with the `YAML_EDITOR_SERVICE` to build UI specs visually.
- **Automatic Part Sharding**: Logic to split large UI specs into lazily-loaded chunks for extreme performance.
