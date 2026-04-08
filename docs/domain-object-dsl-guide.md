# Developer Guide: Domain Object Specification DSL 🏺🛰️

This document specifies the definitive YAML DSL for constructing **Domain Object Specifications** (`spec.yml`) compliant with the `visual-do-editor` and the Never Played platform infrastructure.

## 🏺 1. Foundational Metadata
Every specification must start with basic identification and versioning.

```yaml
id: my-new-domain-object
label: "My Atomic Flow"
version: 1.0.0
metadata:
  name: "My New Flow"
  description: "Meta-application for building Atomic Flow blueprints."
```

## 🏺 2. Domain Object Configuration
This layer defines how the platform persists and categorizes data.

```yaml
domainObject:
  strategyId: LOCAL_STRATEGY        # Gravity: LOCAL_STRATEGY, CLOUD_STRATEGY, VOLATILE_STRATEGY
  label: "Flow Object"              # Human-readable name for instances
  limesPrefix: MYFLOW               # Strategic prefix for institutional IDs
  properties:                       # Default property labels
    label: "Flow Primary Label"
  actions:                          # Global actions for this object type
    - id: view
      label: "Open Flow"
      icon: "fas fa-play"
```

## 🏺 3. Identity and Security (Guards)
Access control is managed via `permissionKeys` mapped to `features` and `guards`.

### Permission Keys
Institutional identifiers for raw permissions.
```yaml
permissionKeys:
  MYFLOW_VIEW:
    id: MYFLOW_VIEW
    label: "myflow:view"
    value: "myflow:view"
```

### Features & Capabilities
Features group keys; capabilities map them to users via matchers.
```yaml
features:
  MYFLOW_ADMIN:
    id: MYFLOW_ADMIN
    label: "myflow:admin"
    keys: [MYFLOW_VIEW, MYFLOW_EDIT]

capabilities:
  - id: ADMIN_ROLE
    operator: "OR"
    matchers: [{ type: "matchAlways" }] # Development setting
    features: [{ id: "MYFLOW_ADMIN", keys: [MYFLOW_VIEW, MYFLOW_EDIT] }]
```

### Security Guards
Used to conditionally render UI parts or enable actions.
```yaml
guards:
  - id: MYFLOW_VIEW
    operator: "OR"
    matchers: [{ type: "matchAlways" }]
    features: [{ id: "MYFLOW_ADMIN", keys: [MYFLOW_VIEW] }]
```

## 🏺 4. UI Orchestration (Multi-Step Flows)
The `ui` section defines the user experience as a series of **Steps**.

```yaml
ui:
  initialStep: welcome
  steps:
    welcome:
      title: "Welcome to My Flow"
      parts:
        intro_card:
          type: card
          variant: info
          label: "Getting Started"
          parts:
            intro_text: { type: text, value: "Hello from YAML!" }
```

## 🏺 5. UI Component Library (Parts)
Supported `parts` include:

| Component | Kind/Type | Description |
|-----------|-----------|-------------|
| **Card** | `card` | Container for grouping parts with a header and variant styling. |
| **Row** | `row` | Horizontal layout container. |
| **Text** | `text` | Markdown-supported text block. |
| **Action** | `action` | Button that triggers a platform service or navigation. |
| **Text Input** | `text-input`| Reactive input for flow state modification. |
| **Select** | `select-input`| Dropdown with predefined `options`. |

### Action & Navigation
Actions use `call` and `params` to interact with the platform.
```yaml
parts:
  start_btn:
    kind: action
    label: "Proceed"
    action:
      call: step.navigate
      params:
        target: my_next_step
```

## 🏺 6. Reactive Patterns
As per [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md), use `${variable}` markers for late-binding data resolution. The UI will automatically "wake up" when data arrives in the flow state.

---
**Status**: 🏰 **Stable Platform DSL**
**Institutional Reference**: [spec_factory.py](scripts/spec_factory.py)
