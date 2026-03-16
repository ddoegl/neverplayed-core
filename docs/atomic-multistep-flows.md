# Atomic Multi-step Flows

Atomic Bundles support declarative multi-step flows using a combination of YAML specifications and the `UIFactory` component. This allows for complex user interactions like wizards, data entry flows, and conditional logic without writing custom JavaScript.

## Schema Overview

The UI specification supports a `steps` object and an `initialStep` property.

```yaml
ui:
  initialStep: welcome # Optional: ID of the first step (defaults to first key in steps)
  steps:
    welcome:
      order: 1       # Optional: define sequence for NEXT_STEP/PREV_STEP
      title: "Welcome"
      parts:
        intro:
          type: "text"
          value: "Hello World"
        next:
          type: "action"
          label: "Start"
          call: "NEXT_STEP"
```

### Steps Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `order` | `number` | Defines the sequence for sequential navigation. |
| `title` | `string` | Displayed as a heading for the step. |
| `parts` | `object` | Dictionary of UI parts to render in this step. |

### Navigation Actions

Specific action IDs are reserved for flow control:

- `NEXT_STEP`: Move to the next step defined by the `order` property.
- `PREV_STEP`: Return to the previous step in history.
- `GO_TO_STEP`: Jump to a specific step. requires `params.targetStep`.

Example `GO_TO_STEP`:
```yaml
type: "action"
label: "Jump to End"
call: "GO_TO_STEP"
params:
  targetStep: "confirmation"
```

## Component Types

### Input Component

Used to collect data from the user.

```yaml
type: "input"
id: "userName"
label: "Your Name"
placeholder: "Enter name..."
value: "Default" # Optional initial value
inputType: "text" # Optional: text, number, password, etc.
```

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
