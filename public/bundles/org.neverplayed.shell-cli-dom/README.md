# 🖥️ Shell CLI DOM
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Shell CLI DOM** bundle provides the primary browser-based user interface for the `ShellCLI`. it renders the terminal emulator using plain HTML/CSS and Alpine.js.

## 🏛️ Architecture & Implementation

- **Reactive Rendering**: Uses Alpine.js to bind the CLI history directly to a scrolled DOM container.
- **State Partitioning**: Strictly separates the visual history from the logical execution handled by `org.neverplayed.shell-cli`.
- **Theme Awareness**: Responds to the platform's CSS variables for consistent "Retro-Cyber" styling.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Reactive State Management** (Pattern 1/ADR-0002).
- **[ADR-0019: Platform Namespace Isolation](../../docs/adr/0019-platform-namespace-isolation.md)**: Ensures the CLI DOM does not pollute the application state.

## 🚀 Future Road

- **Multiple Viewports**: Support for multiple CLI instances in split-pane layouts.
- **Virtual Scrolling**: Optimized rendering for high-activity log streams.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `FLOW_SERVICE`
- `SHELL_CLI_SERVICE`
- `BUNDLE_TYPE_SERVICE`
- `SHELL_CLI_PID`
