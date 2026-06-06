# 🗄️ Persistence FS-Sync
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)

The **Persistence FS-Sync** bundle provides a bidirectional synchronization bridge between the browser's `PersistenceManager` and the local server's filesystem.

## 🏛️ The Patterns
This bundle implements the **Digital Twin Bridge** pattern to facilitate synchronization between partitioned V8 contexts.

For core platform standards, see [platform-patterns.md](../../docs/platform-patterns.md).

### Mandatory ADR Compliance
- [ADR-0024: Dual-Mode Persistence Shunting](../../docs/adr/0024-dual-mode-persistence-shunting.md)
- [ADR-0021: Defensive Tier Fallback](../../docs/adr/0021-defensive-tier-fallback.md)

## 🏛️ Architecture & Implementation

- **Hot-Reload Bridge**: Periodically polls `./.neverplayed/state.json` and hydrates the local store. This allows developers to edit configuration files on disk and see the UI update instantly.
- **Event-Driven Upstream**: Listens to the OSGi `EventAdmin` for `CONFIG_UPDATED` topics and automatically POSTs local state changes back to the server.
- **Local Dev Twinning**: Creates a "Digital Twin" of the server state in the browser, ensuring consistency during local development.

### Synchronization Logic
- **Poll**: Checks every 5 seconds for changes in the remote `.neverplayed/state.json`.
- **Patch**: Only updates local keys that differ from the remote state to minimize Alpine.js re-renders.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Strategic Data Shunting** (Pattern 7/ADR-0003) and **Defensive Tier Fallback** (ADR-0021).
- **[ADR-0024: Dual-Mode Persistence Shunting](../../docs/adr/0024-dual-mode-persistence-shunting.md)**: Governs the protocol for synchronizing across the "Stealth Tunnel."

## 🚀 Future Road

- **WebSocket Ingress**: Transition from 5s polling to a reactive WebSocket-based stream for absolute instant sync.
- **Conflict Resolution**: Logic to handle simultaneous edits in the UI and on disk.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `PERSISTENCE_MANAGER_SERVICE`
- `EVENT_ADMIN_SERVICE`
- `EVENT_FACTORY_SERVICE`
