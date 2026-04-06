# 🛡️ YAML Editor Bundle

The **YAML Editor** is a foundational UI component for the Never Played ecosystem, providing a centralized interface for editing domain object blueprints, system configurations, and semantic state.

## 🏛️ Architecture

- **Service-Driven**: Registers the `YAML_EDITOR_SERVICE` (defined in `core-types.js`) to allow cross-bundle invocation.
- **Reactive State**: Utilizes an Alpine.js global store (`$store.yamlEditor`) to manage visibility, content, and lifecycle callbacks.
- **Direct Mounting**: The bundle's activator fetches a template from its own directory and mounts it directly to `document.body` on startup to ensure universal availability.

## 🛠️ Components

- **Activator**: `activator.js` - Orchestrates the lifecycle and service registration.
- **UI Template**: `templates/editor.html` - Contains the Alpine.js-powered modal overlay and styling.

## 🚀 Recommended Refactorings (Future Road)

As the project evolves, the following upgrades are highly recommended:

### 1. Monaco Editor Integration (High Priority)
- **Current State**: Uses a standard HTML `<textarea>`.
- **Target State**: Replace with the **Monaco Editor** (the engine behind VS Code).
- **Benefits**: 
  - Syntax highlighting for YAML.
  - Real-time schema validation (using the `YAML_SERVICE`).
  - Improved editing experience (multi-cursor, find/replace, auto-indent).

### 2. Form-Based Alternative View
- Provide a togglable view to switch between a raw YAML editor and a dynamically generated form based on domain object schemas.

### 3. Service Lifecycle Improvements
- Integrate with the `ActionRegistry` to automatically expose "Edit Artifact" actions for any domain object with a YAML backing.
- Implement better error handling for malformed YAML using the `YAML_SERVICE`'s diagnostic capabilities.

## ⚠️ Security Notes
- Ensure all content passed to the editor is sanitized if it contains raw HTML (though YAML is generally data-focused).
- The editor does not currently manage its own permissions; it relies on the caller (e.g., `RealmManager`) to enforce access control.
