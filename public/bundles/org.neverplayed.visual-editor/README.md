# 🛡️ Visual Editor Bundle

A foundational meta-flow inhabitant for building, designing, and exploring **Atomic Flow blueprints** through a structured, form-based interface.

## 🏛️ Architecture & Implementation

- **Standard Inhabitant**: Implemented as a sovereign inhabitant that can be emerged in any realm context to provide WYSIWYG editing capabilities.
- **Master-Detail Orchestration**: Uses a `Master-Detail` UI pattern to manage flow steps (Sidebar) and property editing (Main Panel).
- **Reactive Synchronization**: Leverages an internal state store with property binding to provide a real-time "Live Preview" of the flow as it is being edited.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Inhabitant sovereignty** (Pattern 16/ADR-0016) and **Non-Destructive Rendering** (Pattern 17/ADR-0008).
- **[ADR-0016: Inhabitant Layer Sovereignty](../../docs/adr/0016-inhabitant-layer-sovereignty.md)**: Guarantees that the visual editor does not pollute the parent namespace of the hosting realm.
- **Service Integration**: Tracks the `ACTION_REGISTRY_SERVICE` to provide real-time binding for command buttons within the editor.

## 🛠️ Components

- **Activator**: `activator.js` - Handles inhabitant registration and host bridge injection.
- **Core Component**: `components/atomic-visual-editor.js` - The main WYSIWYG editor logic using Web Components and Shoelace.
- **Live Preview Engine**: Integrated rendering pane that demonstrates exactly how the flow will appear to the end-user.

## 🚀 Existing Capabilities

- **Form-Based Editing**: Structured property panels for steps and UI parts (Text, Inputs, Buttons).
- **Live Simulation**: real-time rendering of the flow in the "Live Preview" pane as you modify properties.
- **YAML Synchronization**: Bi-directional sync with the **[YAML Editor](../org.neverplayed.yaml-editor/README.md)** for advanced users.
- **Blueprint Ingestion**: Direct integration with the `ATOMIC_SPEC_INGESTION_SERVICE` to register flows into the system.

## 🚀 Future Road

- **Drag-and-Drop Canvas**: Transition from the current form-based list to a visual node-based coordinates system.
- **Collaborative Editing**: Real-time multi-user editing supported by the Cloud tier.
- **Validation Engine**: Real-time feedback on "Orphan Steps" or broken action references.
