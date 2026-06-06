# ⌨️ Shell CLI Term
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


The **Shell CLI Term** bundle provides the low-level terminal emulation logic for the Never Played platform, typically used for non-DOM or high-performance text rendering.

## 🏛️ Architecture & Implementation

- **ANSI Interpretation**: Handles raw text streams and escape sequences for stylized output.
- **Output Buffering**: Ensures smooth log delivery even when the OSGi registry is performing batch operations.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **System Logging Integration** (ADR-0013).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Xterm.js Integration**: Upgrade to full Xterm.js support for advanced terminal features (copy/paste, resizable buffers).

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `SHELL_CLI_SERVICE`
