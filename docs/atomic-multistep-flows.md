# Atomic Multi-step Flows

Atomic Bundles support declarative multi-step flows using a combination of YAML specifications and the `UIFactory` component. This allows for complex user interactions like wizards, data entry flows, and conditional logic without writing custom JavaScript.

## Schema Overview (uiSpec Aligned)

The UI specification follows the **W3C uiSpec** meta-model, focusing on semantic `kind` and component `anatomy`.

```yaml
ui:
  initialStep: welcome
  steps:
    welcome:
      order: 1
      title: "Welcome"
      parts:
        intro:
          kind: "text" # Or 'type'
          value: "Hello World"
        next:
          kind: "command-button"
          variant: "primary" # Shoelace-compatible variants
          label: "Start"
          call: "NEXT_STEP"
```

### Core Concepts

| Term | Description |
| :--- | :--- |
| **Kind** | The semantic category of the element (e.g., `command-button`, `text-input`). |
| **Anatomy** | The constituent parts of a component (managed internally by Web Components). |
| **Variants** | Standardized visual intents: `primary`, `success`, `neutral`, `warning`, `danger`. |

### Component Suite

Atomic Bundles now leverage the **Shoelace** component library under the hood for a premium look and feel.

#### Command Button (`kind: command-button`)
Wraps `<sl-button>`. Supports `variant`, `size`, and `pulse`.

#### Text Input (`kind: text-input`)
Wraps `<sl-input>`. Supports `label`, `placeholder`, and pill styling.

### Result Component

Used to display the output of the last performed action (e.g., API response).

```yaml
type: "result"
```

## Data Binding & Interpolation

User inputs are stored in a `values` object and can be referenced in text or action parameters using `${this.propertyName}` syntax.

### Text Interpolation
```yaml
type: "text"
value: "Hello, **${this.userName}**!"
```

### Action Parameter Interpolation
```yaml
onAction:
  call: "someService"
  params:
    userId: "${this.userName}"
    endpoint: "https://api.example.com/users/${this.userName}"
```

## Architecture Notes

### Persistent State Registry
The `UIFactory` implements a persistent state registry (`globalThis.__UI_FACTORY_REGISTRY`). This ensures that:
1. **Shell Stability**: If the shell re-scans the DOM or moves the component, Alpine.js reconnects to the existing state rather than resetting to Step 1.
2. **Instance Isolation**: Every component has a unique ID, allowing multiple flows to run independently on the same page.

### Compatibility Aliases
For maximum compatibility with older shell versions, the component supports both modern property setters (`spec`, `context`) and method-based initialization (`setSpec`, `setBundleContext`).
