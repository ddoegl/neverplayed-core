# 🗄️ Persistence FS-Sync

The **Persistence FS-Sync** bundle provides a bidirectional synchronization bridge between the browser's `PersistenceManager` and the local server's filesystem.

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
