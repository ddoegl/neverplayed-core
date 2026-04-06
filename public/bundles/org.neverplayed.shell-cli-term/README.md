# ⌨️ Shell CLI Term

The **Shell CLI Term** bundle provides the low-level terminal emulation logic for the Never Played platform, typically used for non-DOM or high-performance text rendering.

## 🏛️ Architecture & Implementation

- **ANSI Interpretation**: Handles raw text streams and escape sequences for stylized output.
- **Output Buffering**: Ensures smooth log delivery even when the OSGi registry is performing batch operations.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **System Logging Integration** (ADR-0013).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Xterm.js Integration**: Upgrade to full Xterm.js support for advanced terminal features (copy/paste, resizable buffers).
