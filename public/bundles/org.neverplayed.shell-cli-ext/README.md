# 📑 Shell CLI Extensions

The **Shell CLI Extensions** bundle provides a collection of advanced management commands that extend the base functionality of the `ShellCLI`.

## 🏛️ Architecture & Implementation

- **Decoupled Commands**: Registers individual `SHELL_COMMAND_SERVICE` instances for specialized tasks like `inspect`, `matrix`, or `registry-clean`.
- **Context Awareness**: Commands receive the full `BundleContext` to perform deep system inspection.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Plugin Orchestration** (ADR-0013).
- **[ADR-0012: Lifecycle Guards](../../docs/adr/0012-lifecycle-guards.md)**: Ensures extensions do not block the main shell loop during extraction.

## 🚀 Future Road

- **Visual Inspections**: Commands that can trigger UI overlays for data visualization.
- **Snapshot Support**: Commands to export/import the current service registry state.
