# 🛡️ Shell Header Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Top-level UI navigation and status bar, providing centralized access to identity management, session awareness, and global search.

## 🏛️ Architecture & Implementation

- **Direct UI Mount**: Targeted mounting to the `#shell-header` ID via CSS selector (as defined in `manifest.json`).
- **Alpine Magic Integration**: Fully harmonized to use the global `$session` magic property, eliminating redundant local session tracking and providing direct, reactive identity context.
- **Sovereign Context Awareness**: Provides real-time visual feedback for identity focus via **Ghost** (Carried Being) and **Mask** (Materialized Surrogate) overlays on the user avatar.
- **Reactive Visibility**: Uses `$store.platform.kernelReady` and `$session.currentUser` for dynamic content rendering.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Multi-Phase Boot** (Pattern 2/ADR-0014) and **Platform Namespace Isolation** (Pattern 3/ADR-0019).
- **[ADR-0014: Multi-Phase Boot](../../docs/adr/0014-multi-phase-boot.md)**: Standardized visibility using the `kernelReady` state to prevent flashing of unstyled/unhydrated content.
- **[ADR-0019: Platform Namespace Isolation](../../docs/adr/0019-platform-namespace-isolation.md)**: Respects the segregation of shell internal telemetry and application-specific session data.

## 🚀 Future Road

- **Dynamic Extension Points**: Support "Header Inhabitant" services to allow realms to inject their own buttons and dropdowns into the bar.
- **Breadcrumb Navigator**: Add a reactive breadcrumb path connected to the `RealmManager`'s current context.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `REALM_SERVICE`
- `REALM_MANAGER_SERVICE`
- `SYSTEM_RESET_SERVICE`
- `SESSION_SERVICE`
- `STRATUM_SERVICE`
- `PERSISTENCE_MANAGER_SERVICE`
- `AUTH_SHIELD_SERVICE`
- `PERCEIVER_SERVICE`
- `SHELL_UI_CONTEXT_PID`
- `UI_STORAGE_PID`
