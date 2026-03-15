# Ideation: The Atomic Bundle & UI-DSL (Configuration-over-Code)

## 1. Vision: The "Atomic Bundle"

Currently, adding a new feature requires coordinating multiple bundles (DO
Registry, Capabilities, Limes, UI Flow). An **Atomic Bundle** is a purely
declarative OSGi bundle that defines its entire domain "stack" in a single
`spec.yaml` (or equivalent structure).

### The "Atomic Spec" Components

- **Domain Model**: Defines the object structure, properties, and basic actions.
- **Access Control**: Defines permission keys, capability strategies, and Limes
  guards.
- **UI Layout**: Defined via a high-level **UI-DSL** (processed by
  `ui-factory`).
- **Workflow**: Links to a BPMN process for lifecycle transitions.
- **Actions**: Declarative mapping of UI triggers to system services or BPMN
  signals.

---

## 2. UI-DSL & `ui-factory` Architecture

The `ui-factory` is a system-wide Web Component that translates the UI-DSL into
a reactive Alpine.js tree.

### UI-DSL Schema (Ideation)

```yaml
parts:
  summary:
    type: "card"
    title: "Project Status"
    state: "${this.status === 'ACTIVE' ? 'success' : 'warning'}"
  actions:
    - label: "Sign Document"
      icon: "fas fa-pen"
      showIf: "limes.isAllowed(currentUser, 'DO_SIGN')"
      onAction:
        type: "bpmn-signal"
        id: "SIGN_REQUESTED"
```

### Key Concepts

- **Pure Data**: The DSL contains only strings, numbers, and template
  expressions.
- **Safe Evaluation**: Expressions are evaluated against the local `hostState`
  context using a restricted parser or Alpine's expression engine.
- **Action Registry**: UI triggers call logic by name (`domainService.save`),
  not by code.

---

## 3. The Orchestrator (Runtime Deployment)

A new **Atomic Orchestrator** system service will:

1. **Track Bundles**: Listen for bundles with a `Bundle-Type: atomic` header.
2. **Hydrate Registry**: Automatically register the `FLOW_SERVICE`,
   `DO_STRATEGY`, and `CAPABILITY_STRATEGY` based on the YAML spec.
3. **Manage State**: Persist runtime configurations into the
   `PersistenceManager`, allowing the **Backoffice** to "build" and "deploy"
   these bundles without a server restart.

---

## 4. Experiment: `hello-world-do`

To test this, we will implement a minimal `hello-world-do` bundle.

### Step 1: `spec.yaml`

```yaml
id: hello-world
label: "Hello World Object"
properties:
  - name: greeting
    type: string
capabilities:
  - id: HELLO_VIEW
    matchers: [{ type: matchAlways }]
ui:
  template: "simple-form"
  parts:
    - type: text
      value: "Current Greeting: ${this.greeting}"
    - type: action
      label: "Update"
      call: "hello.update"
```

### Step 2: Runtime Orchestration

The Backoffice's "Manage Bundles" UI will allow creating these specs. Once
saved, the Orchestrator will "spawn" a virtual bundle that exists in the Service
Registry.

---

## 5. First Steps for Execution

1. **Shared Types Upgrade**: Add `ATOMIC_BUNDLE_SERVICE` and
   `BUNDLE_TYPE_ATOMIC`.
2. **`ui-factory` Foundation**: Build the core Web Component that can render a
   basic YAML-driven Alpine UI.
3. **Atomic Orchestrator PoC**: A bundle that can take a static `spec.yaml` and
   "unfold" it into the various system registries.
4. **BPMN Integration**: Wiring the `ui-factory` actions to the `bpmn-engine`.
