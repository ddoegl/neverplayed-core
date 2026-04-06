# ADR-0024: Dual-Mode Persistence Shunting

## Status
Accepted

## Context
When operating in restricted network environments (e.g., corporate proxies blocking WebSockets) or during high-latency startup, the standard Firebase Firestore SDK can fail to establish a real-time connection. This causes data loss or UI freezes in reactive components.

## Decision
We will implement a **Dual-Mode Connectivity Strategy** for cloud persistence (The "Double-Fallback"):

1. **Mode A (SDK/Real-time)**: Default WebSocket connection using the standard Firebase Firestore SDK. This provides low-latency, bi-directional synchronization.
2. **Mode B (REST/Stateless)**: A fallback "Stealth Tunnel" via an HTTPS POST bridge (`mcpApi` Cloud Function).

### Rules for Shunting:
- **Write Availability**: If a `store()` request fails via the SDK, it must be immediately "shunted" to the REST bridge.
- **Read Fallback**: If the SDK fails to hydrate on boot, the bundle must perform a one-time "Stateless Read" from the REST bridge to ensure the UI is not empty.
- **Administrative Access**: Mode B is permitted to bypass Firestore Security Rules via the Firebase Admin SDK when authorized by a `neverplayed-admin` claim.

## Consequences
- **Positive**: 100% write availability even in firewalled environments.
- **Positive**: Resilient boot hydration for headless agents.
- **Negative**: Increased latency for Mode B operations.
- **Negative**: "Mode B" ignores real-time updates from other clients until the next SDK reconnection or manual refresh.
