# 🧩 Shared UI Components

The **Shared UI** bundle is the central registry for "Atomic" design components and the logic for the platform's standardized **UI Factory**.

## 🏛️ Architecture & Implementation

- **Atomic Component Registry**: Manages the mapping between logical component kinds (e.g., `command-button`, `master-detail`) and their underlying Custom Element tag names.
- **UI Factory Service**: provides a high-level service for creating complex UI trees from declarative JSON/YAML specifications.
- **Action Ingress**: Registers standard platform actions (e.g., `step.navigate`, `synthetic.client.summary-alert`) into the centralized `ActionRegistry`.

### Component Registration
New bundles can contribute UI components by registering with the `ATOMIC_COMPONENT_REGISTRY_SERVICE`:
```javascript
const registry = context.getService(context.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE));
registry.register('my-special-widget', 'org-neverplayed-widget');
```

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **UI Factory & Atomic Components** (Pattern 12/ADR-0016).
- **[ADR-0016: Inhabitant Layer Sovereignty](../../docs/adr/0016-inhabitant-layer-sovereignty.md)**: Governs the rendering scope of components within their host environments.

## 🚀 Future Road

- **Theming Engine**: Dynamic HSL color token injection for all registered atomic components.
- **Visual Spec Editor**: Integration with the `YAML_EDITOR_SERVICE` to build UI specs visually.
