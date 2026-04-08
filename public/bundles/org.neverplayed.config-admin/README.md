# 🛡️ Config Admin Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Dynamic configuration management for all system and application bundles, allowing for runtime overrides of manifest settings.

## 🏛️ Architecture & Implementation

- **Centralized PID Store**: Manages Persistent Identifiers (PIDs) for each bundle.
- **Override Logic**: Follows the `Bundle Config` -> `Environment Override` -> `Manual Override` hierarchy.
- **Service Integration**: Registers the standard `OSGi Configuration Admin` service.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Constant Compliance** (ADR-0013) for PID resolution and **Event Signaling** (Pattern 6) for update notifications.
- **[ADR-0005: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Uses the `EventAdmin` to signal `config-updated` events when a bundle's configuration is modified.

### Fragment Shadowing (UI Injection)
For small UI utilities like the Config Editor, we use the **Fragment Shadowing** pattern. We inject a reactive proxy directly onto the target element's internal `_x_dataStack` property to seed the Alpine scope without destroying existing layout.

```javascript
launch: (async (targetElement) => {
  const state = Alpine.reactive({ config: {} });
  targetElement._x_dataStack = [state]; // Seed the Alpine stack
  targetElement.innerHTML = await fetch("view.html").text();
});
```

## 🚀 Future Road

- **Configuration Schemas**: Add JSON Schema validation for all bundle configuration PIDs.
- **GUI Editor**: Built-in UI to edit system configurations (integrating with the `YAML Editor`).

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
