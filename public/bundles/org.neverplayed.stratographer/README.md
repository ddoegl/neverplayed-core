# org.neverplayed.stratographer

The **Stratographer** is the definitive Forensic Cockpit for the Never Played OS. It consolidates environmental awareness, network topology, and forensic trace recovery into a single, high-fidelity dashboard resident in the Flow Stage.

## The Patterns (ADR-008)

### 1. Sovereign Address Bar
The Stratographer implements the "Address Bar" metaphor as the system's primary navigational index. It mirrors the current Stratum URI and provides a direct interface for "Jumping" between coordinates across both Idealist and Realist perspectives.

### 2. Forensic 3-Column Layout
- **Ontological Compass (Left)**: Real-time status of WHO (Identity), WHERE (Realm), and HOW (Tier). Handles realm switching and identity awareness.
- **Areal Navigator (Center)**: D3-powered optical engine visualizing the Stratum topology. Supports topological nodes for Tenants, Realms, and Identities.
- **Forensic Vault (Right)**: Deep inspection pane for stashed keys and forensic traces. Ignites upon node selection in the Navigator.

### 3. Temporal Settlement
The dashboard utilizes a spatial handshake via `ResizeObserver` to ensure the D3 simulation is perfectly centered within the flexible Stage layout, regardless of display resolution.

## Manifest Configuration
- **Bundle-SymbolicName**: `org.neverplayed.stratographer`
- **Flow Policy**: Registered as a primary startup flow in Core and Foundation realms.
- **Dependencies**: `org.neverplayed.stratum-explorer`, `org.neverplayed.stratum-core`.

## Operational Commands
The dashboard dispatches `shell-execute` and `explorer-render-request` events to coordinate with the underlying OS layers.
