# 🖥️ Shell CLI DOM

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
