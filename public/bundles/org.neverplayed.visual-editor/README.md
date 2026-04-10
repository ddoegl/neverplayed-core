# 🛡️ Visual Editor Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


A foundational meta-flow inhabitant for building, designing, and exploring **Atomic Flow blueprints** through a structured, form-based interface.

## 🏛️ Architecture & Implementation

- **Standard Inhabitant**: Implemented as a sovereign inhabitant that can be emerged in any realm context to provide WYSIWYG editing capabilities.
- **Component Strategy**: Registers and tracks `ATOMIC_COMPONENT_REGISTRY_SERVICE` to host the `visual-editor` strategy.
- **Action Discovery**: Tracks the `ACTION_REGISTRY_SERVICE` to provide real-time binding for command buttons within the editor.
- **Master-Detail Orchestration**: Uses a `Master-Detail` UI pattern to manage flow steps (Sidebar) and property editing (Main Panel).

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Inhabitant sovereignty** (Pattern 16).
- **[ADR-0025: Identity Injection](../../docs/adr/0025-identity-injection-id-tokens.md)**: Governs visual element identity for binding.
- **[ADR-0026: Reactive Variable Resolution](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md)**: Used in the Live Preview engine.
- **[ADR-0027: Semantic Bundle Versioning](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)**: Governs bundle lifecycle.
- **[ADR-0029: Universal Interactor Service](../../docs/adr/0029-universal-interactor-service.md)**: Decouples the editor from UI side-effects.
- **[ADR-0031: Proactive Discovery Orchestration](../../docs/adr/0031-proactive-discovery-orchestration.md)**: Governs the ingestion of editor-built blueprints.

## 🛠️ Components

- **Activator**: `activator.js` - Handles inhabitant registration and host bridge injection.
- **Core Component**: `components/atomic-visual-editor.js` - The main WYSIWYG editor logic using Web Components.
- **Live Preview Engine**: Integrated rendering pane demonstrating the active flow.

## 🚀 Existing Capabilities

- **Form-Based Editing**: Structured property panels for steps and UI parts (Text, Inputs, Buttons).
- **Live Simulation**: Real-time rendering of the flow in the "Live Preview" pane.
- **YAML Synchronization**: Sync with the **[YAML Editor](../org.neverplayed.yaml-editor/README.md)**.
- **Blueprint Ingestion**: Direct integration with the `ATOMIC_SPEC_INGESTION_SERVICE`.

## 🚀 Future Road

- **Drag-and-Drop Canvas**: Visual node-based coordinates system.
- **Collaborative Editing**: Real-time multi-user editing.
- **Validation Engine**: Real-time feedback on "Orphan Steps" or broken action references.
