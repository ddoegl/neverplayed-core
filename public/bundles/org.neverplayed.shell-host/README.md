# 🛡️ Shell Host Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The primary rendering container for realm-inhabitant UIs and atomic flows.

## 🏛️ Architecture & Implementation

- **Atomic Mount Point**: Provides the `#shell-host-root` container where other bundles mount their components.
- **Context Injection**: Wraps child UIs in a "Safety Bubble" that prevents CSS/JS bleeding between inhabitants.
- **Status Observer**: Communicates with the `RealmManager` to show loading states during inhabitant transitions.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Non-Destructive Rendering** (Pattern 17/ADR-0008) and **Inhabitant sovereignty** (Pattern 2/ADR-0016).
- **[ADR-0008: Focus Preserving Rendering](../../docs/adr/0008-focus-preserving-rendering.md)**: Implements the decision to use non-destructive DOM updates for child flows where possible.

## 🚀 Future Road

- **Multi-Tab Support**: Allow hosting multiple inhabitants in separate tabs within the same host view.
- **Transition Shims**: Cross-fade animations for inhabitant transitions.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `FLOW_SERVICE`
- `SHELL_HOST_SERVICE`
