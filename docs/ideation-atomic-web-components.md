# Ideation: W3C uiSpec Aligned Architecture

The next evolution of Atomic UI will transition from ad-hoc HTML generation to a standardized **Component Specification Meta-model**, directly aligning with the **W3C UI Specification Schema (uiSpec)** and **OpenUI** initiatives.

## Core Principle: Implementation-Agnostic Specifications

Instead of describing *how* a component looks (CSS classes), we specify the **Intent**, **Anatomy**, and **Constraint** of the UI element. The `UIFactory` then maps this specification to the appropriate high-level Web Components.

### Key Vocabulary Alignments (OpenUI / uiSpec)

| Vocabulary Term | Atomic Usage | Description |
| :--- | :--- | :--- |
| **Anatomy** | `parts` | The constituent parts of a component (e.g., `label`, `input-wrapper`, `prefix-icon`). |
| **States** | `guards` | Standardized states like `disabled`, `readonly`, `loading`, or `invalid`. |
| **Variants** | `variant` | High-level stylistic intents (e.g., `primary`, `danger`, `ghost`). |
| **Slots** | `parts` | Named insertion points for child content. |

---

## Library Face-off: Standards Edition

| Library | uiSpec Compatibility | Recommendation |
| :--- | :--- | :--- |
| **Shoelace** | High (OpenUI inspired) | Best for immediate deployment of standardized elements. |
| **Lit** | Absolute (W3C native) | Best for building the "Atomic Core" that enforces the uiSpec schema. |
| **Material Web** | Strict | Best for Google-standard compliance. |

## Conceptual Mapping (uiSpec Schema)

We will adopt a schema that separates **Data Constraints** from **Layout Intent**.

| YAML Key (uiSpec) | Atomic Mapping | Purpose |
| :--- | :--- | :--- |
| `kind` | `type` | The semantic category (e.g., `command-button`, `text-input`). |
| `context` | `values` | The data-binding context. |
| `behaviors` | `guards` | Conditional logic and visibility rules. |
| `metadata` | `properties` | Domain-specific markers for the Atomic Orchestrator. |

---

## Technical Feasibility: The "Universal Hydrator"

In this model, the `UIFactory` acts as a **uiSpec Hydrator**. It doesn't just "render"; it "instantiates a contract."

```javascript
// The uiSpec Hydration Logic
renderPart(id, partSpec) {
    // 1. Resolve 'kind' to a Web Component
    const tagName = this.lookupRegistry(partSpec.kind || partSpec.type);
    const element = document.createElement(tagName);
    
    // 2. Hydrate Element with uiSpec Data
    // We treat the element as a contract-holder
    if (element.hydrate) {
        element.hydrate(partSpec, this._context);
    } else {
        // Fallback to standard property binding
        element.anatomy = partSpec.anatomy;
        element.variant = partSpec.variant;
        element.state = this._state;
    }
    
    // 3. Bind standard OpenUI behaviors
    element.addEventListener('click', () => {
        if (partSpec.action) this.runAction(partSpec.action, this._state);
    });
    
    return element;
}
```

---

## Library Face-off

| Library | Strength | Use Case |
| :--- | :--- | :--- |
| **Shoelace** | Immediate quality, full suite | "I want standard, beautiful components today." |
| **Lit** | Performance, custom logic | "I want to build my own unique Atomic design system." |
| **FAST (Microsoft)** | Performance, deep theming | "I need highly accessible, enterprise-grade tools." |
| **Material Web** | Google Standard | "I want the familiar Android/Google aesthetic." |

## Conceptual Mapping Table

| YAML Type | Proposed Web Component | Library Support (Shoelace) |
| :--- | :--- | :--- |
| `button` | `<atomic-button>` | `sl-button` |
| `input` | `<atomic-input>` | `sl-input` |
| `select` | `<atomic-select>` | `sl-select` |
| `text` | `<atomic-text>` | `sl-format-text` (or base div) |
| `card` | `<atomic-card>` | `sl-card` |

---

## Technical Feasibility: The "Hydration" Step

In this new model, the `UIFactory` wouldn't just generate a string of HTML. It would:
1.  **Parse** the spec.
2.  **Map** types to component classes.
3.  **Construct** the DOM tree using `document.createElement`.
4.  **Bind** properties using the browser's native property setters (which is much faster than attribute strings).

This also allows components to emit **Custom Events** (e.g., `atomic-submit`) that the `UIFactory` can listen for to trigger shell actions, creating a clean separation between "Visual Look" and "Orchestration Logic."

### 2. The Implementation Flow
1. **Registry**: `UIFactory` maintains a map of `type` -> `tagName`.
2. **Instantiation**: `renderPart` becomes `document.createElement(tagName)`.
3. **Data Passing**: YAML properties are passed directly as attributes or properties to the element.

```javascript
// The future of renderPart
renderPart(id, part) {
    const tagName = this.registry[part.type];
    const el = document.createElement(tagName);
    
    // Assign properties (handles functions, objects, etc.)
    el.spec = part;
    el.context = this._context;
    
    // Event bridging
    el.addEventListener('atomic-action', (e) => {
        this.runAction(e.detail.action, this._state);
    });
    
    return el;
}
```

## Recommendation: The Hybrid Approach
We should use **Shoelace** internally to provide the "Guts" of the components, but wrap them in our own **`<atomic-*>`** tags. This gives us the best of both worlds: immediate premium UI, but the ability to swap the underlying library later without breaking our YAML specs.
