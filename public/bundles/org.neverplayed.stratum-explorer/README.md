# org.neverplayed.stratum-explorer

## Purpose
Provides a high-fidelity, visual topology of the system's multidimensional metadata. Using D3.js, it maps out the active Strati (Facets) and their relationships to Data Gravity (Tiers).

## Dimensions (The Strati)
- **WHO** (Tenant/Identity): The Progenitor path.
- **WHERE** (Realm): The Ambient context.
- **WHAT** (Flow): The Active state.
- **HOW** (Tier): The Persistence strategy (Local/Cloud).

## The Patterns
- **Optical Tracking**: Real-time D3 force-directed updates on `pm-context-shifted`.
- **Reactive Focus**: Uses Alpine.js to synchronize visual state with Command Line jumps.

## Services
- **Import**: `org.neverplayed.domain.Stratum` (Context Source)
- **Export**: `org.neverplayed.ui.Explorer` (Visual Endpoint)

---
🪐🛡️✨
