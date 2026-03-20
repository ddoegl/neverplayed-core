# Ideation: Visual DO Editor (WYSIWYG)

This document outlines the vision for a **Visual DO Editor**—a meta-application built using the project's own atomic patterns to allow building, testing, and exporting Domain Object (DO) blueprints without manual YAML editing.

## Core Concept

The editor is a **Meta-Flow**: an application that treats another flow's `spec.yaml` as its primary data model. It uses the `UIFactory` to render a real-time preview of the flow being edited.

## Architectural Pillar: The Meta-Flow

The Editor itself follows the `Atomic Flow` pattern:
- **Steps**: Each section of the blueprint (`metadata`, `strategies`, `ui`, `logic`) is represented as one or more steps in the editor's flow.
- **State**: The `values` of the editor's `UIFactory` instance contain the entire dynamic blueprint object.

---

## Workspace Layout: The Tri-View

Each step in the `ui` configuration section provides a three-pane view for maximum transparency and control.

### 1. Live Preview ("The Mirror")
- An embedded `ui-factory` instance that renders the current step's `parts` in real-time.
- Reacts instantly as the user modifies properties in the other views.
- **Technical Detail**: Uses an isolated Alpine scope to ensure the editor's state doesn't leak into the preview.

### 2. Visual Editor ("The Canvas")
- A property-panel driven interface to add/remove components.
- **Component Palette**: Drag-and-drop or click-to-add interface using the components showcased in `atomic-showcase`.
- **Property Grid**: Auto-generated forms based on the component's `spec` requirements (e.g., `label`, `kind`, `variant`, `options`).
- **Logic Jumps**: A visual graph or simple dropdown mapping to define `step.navigate` actions.

### 3. YAML View ("The Source")
- A live-synced Monaco or code-style editor showing the raw YAML representation.
- Allows experienced developers to "bypass" the UI for complex configurations (like multi-line interpolation or complex guards).
- Two-way binding: YAML edits update the Visual Editor, and vice versa.

---

## Component Management

The editor leverages the `UIFactory` component registry:
- **Discovery**: Dynamically scans the `shared-ui-components` registry to offer new components as they are added to the system.
- **Templates**: Provides "Starter Kits" for common layouts (e.g., "Standard Input Row", "Information Disclaimer Card").

---

## Logic & Guards Builder

Instead of writing manual `${values.x === 'y'}` strings:
- **Guard Wizard**: A declarative builder to create matchers (e.g., "Show if: `terms` is `true`").
- **State Browser**: A tree-view of the available `values` context to pick properties for interpolation.

---

## The Big Output

At the end of the Editor Flow:
- **Validation**: Ensures the blueprint is schema-valid and logic paths are not circular.
- **Export**: Generates a complete `spec.yaml`.
- **Registration**: Calls the `atomic-orchestrator` to register the new blueprint locally (using `LOCAL_STRATEGY`) so the user can test their creation immediately on the Dashboard.

## Road-to-MVP

1. **Phase 1**: Static YAML editor with Live Preview on the side.
2. **Phase 2**: Static forms for `metadata` and `ui.steps`.
3. **Phase 3**: Visual drag-and-drop for `ui.parts`.
4. **Phase 4**: Logic Graph for complex navigation flows.
