# 🛡️ Shell Sidebar Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Left-hand side navigation panel for switching between flows, managing realms, and accessing system-level settings.

## 🏛️ Architecture & Implementation

- **Service Registry Integration**: Tracks `FLOW_SERVICE` and `REALM_SERVICE` to dynamically generate navigation links.
- **Harmonized Session Integration**: Migrated from legacy store-based user tracking to the global `$session` magic property, ensuring identity consistency across the entire shell.
- **Sovereign Identity Projection**: Displays visual context indicators (**Ghost** for Carried, **Mask** for Materialized) in the footer user area for real-time focus feedback.
- **State Integration**: Uses `$store.realmManager` to highlight the current active universe and its inhabitants.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Reactive State Synchronization** (Pattern 1) and **Navigation Stability** (Pattern 15/ADR-0011).
- **[ADR-0011: Navigation Stability](../../docs/adr/0011-navigation-stability.md)**: Ensures that the navigation framework is persistent and reactive during realm transitions.

## 🚀 Future Road

- **Pinned Flows**: Allow users to pin frequently used flows to the top of the sidebar.
- **Mini-Analytics**: Inject small sparklines into sidebar items to show activity indicators in real-time.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `CONFIG_ADMIN_SERVICE`
- `SHELL_HOST_SERVICE`
- `SHELL_COMMAND_SERVICE`
- `LIMES_SERVICE`
- `SESSION_SERVICE`
- `REALM_MANAGER_SERVICE`
- `SHELL_CLI_PID`
- `EVENT_MONITOR_PID`
