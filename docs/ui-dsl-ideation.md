# Ideation: Advanced DSL with Actions & State Maps

## 1. The State Map

Instead of hardcoding styles, the YAML defines a `stateMap`. The Web Component
translates these into Alpine.js `:class` or `:style` bindings.

- **OpenUI Alignment:** Components have "States" (e.g., `pressed`, `hovered`,
  `expanded`).

## 2. The Action Registry

To prevent `eval()` (which is a security risk), we implement an **Action
Registry**.

- The YAML defines an `action: "notify"`.
- The Web Component looks up "notify" in a predefined JS object.
- This allows the DSL to trigger real application logic while staying "pure
  data."

## 3. Component Anatomy

- **Trigger:** Now handles both `state` toggling and `action` execution.
- **Content:** Visibility is bound to the `state.expanded` property.
