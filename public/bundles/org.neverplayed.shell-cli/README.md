# 🐚 Shell CLI Core
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Shell CLI** bundle is the central command-line interface for the Never Played ecosystem. it orchestrates the "Low-Level" interaction with the OSGi Service Registry and governs bundle lifecycles.

## 🏛️ Architecture & Implementation

- **Command Discovery**: Uses a service tracker on `org.neverplayed.shell.Command` to dynamically expand the command set at runtime.
- **Inhabitant Guard**: Integrates with the `RealmManager` to ensure that manually installed bundles are registered in the inhabitant layer for persistence across realm switches.
- **Headless & UI Dual-Mode**: automatically detects the environment and routes log output to either the `SystemLogger` or the browser console.

### Extensibility Pattern
To add a new command to the shell, register a service with the following interface:
```javascript
context.registerService(SHELL_COMMAND_SERVICE, {
    name: "mycommand",
    description: "Does something awesome",
    execute: (args, ctx, log) => { ... }
});
```

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Command Orchestration** and **Constant Compliance** (Pattern 3/ADR-0013).
- **[ADR-0016: Inhabitant Layer Sovereignty](../../docs/adr/0016-inhabitant-layer-sovereignty.md)**: Governs how the shell interacts with the realm-level inhabitant registry.
- **[ADR-0020: Early Boot Registration Buffer](../../docs/adr/0020-early-boot-registration-buffer.md)**: Ensures the shell is ready for the intensive boot-time registration spike.

## 🚀 Future Road

- **Autocomplete API**: Standardized tab-completion for service names and bundle IDs.
- **Remote Shell (MCP)**: Execute shell commands over the Model Context Protocol bridge.
