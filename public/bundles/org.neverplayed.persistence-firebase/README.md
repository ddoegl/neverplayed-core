# 🛡️ Firebase Persistence Bundle

The **Decision Authority** for real-time cloud synchronization and shunted failsafe persistence.

## 🏛️ Architecture & Implementation

- **Dual-Mode Persistence**: Primary real-time synchronization via the Firestore WebSocket SDK, with an automatic stateless fallback to the `mcpApi` REST bridge (adhering to [ADR-0024](../../docs/adr/0024-dual-mode-persistence-shunting.md)).
- **Resilient Transport**: Uses `experimentalForceLongPolling: true` to bypass QUIC handshake resets in restricted network environments.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Shunted Fallback (Stealth Tunnel)** (Pattern 21) and **Strategic Shunting** (Pattern 7).
- **[ADR-0018: Service Hydration Handshake](../../docs/adr/0018-service-hydration-handshake.md)**: Implements `waitReady()` to ensure consumers are not blocked during slow boot connections.

### Shunting Implementation (Mode B)
When the Firebase SDK is unavailable (e.g. `ERR_WS_UPGRADED_FAILED`), the bundle enters **Shunted Mode**. 
- **Header**: Passes the ID token in the `x-mcp-token` header.
- **Logic**: Calls `_attemptShunt` which triggers an HTTPS `POST` to the Stealth Tunnel to ensure write availability.

## 🚀 Future Road

- **Conflict Resolution**: Implement "Last-Writer-Wins" or "Merge" strategies for concurrently shunted writes.
- **Offline Buffer**: Add local-storage queuing for shunts that fail due to missing identity.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
