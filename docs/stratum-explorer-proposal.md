# Proposal: Visual Stratum Explorer

## Objective
To provide a high-fidelity, visual map of the system's multidimensional topology. The Explorer will allow developers to navigate "Strati" (Facets), observe "Data Gravity" (Tiers), and query the "Sovereign Vault" through a graphical representation.

## Core Concepts

### 1. Dimensional Nodes (Facets)
The UI represents the four primary dimensions of the Stratum as nodes in a graph:
- **WHO** (Identity)
- **WHERE** (Realm)
- **WHAT** (Flow)
- **HOW** (Tier)

### 2. Gravity Wells (Tiers)
Visual "spheres" representing `local` vs `cloud`.
- **Local Sphere**: Cyan glow, items limited to the current browser/device.
- **Cloud Sphere**: Amber glow, items synchronized across the decentralized fabric.

### 3. Forensic Probing
- **Pulse Search**: Enter a key (e.g. `config.active-theme`) and see it "light up" in the graph at its active landing site.
- **Stratum Query**: Filter the view to "Only Cloud items for Alice".

## Proposed Implementation (TDD Phase)

### Component: `org.neverplayed.stratum-explorer`
A new bundle providing an Alpine.js-based visualization using **Mermaid.js** or **D3.js** for the topology.

### Interaction Model
- **Click-to-Jump**: Clicking a Node (e.g., Identity 'Bob') triggers a `/stratum jump` to that specific facet.
- **Vault Inspect**: Clicking a Gravity Well opens a list of keys currently residing in that tier for the active context.

## Metadata Integration
The Explorer will utilize the new `PersistenceSelector.probe()` and `StratumCore.toURI()` methods to maintain a real-time, ground-truth view of the system.

---
**Status**: DRAFT / SEEKING FEEDBACK 🪐🛰️✨
