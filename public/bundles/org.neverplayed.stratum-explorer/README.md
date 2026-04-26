# org.neverplayed.stratum-explorer

## Purpose
Provides a high-fidelity, visual topology of the system's multidimensional metadata. Using D3.js, it maps out the active Strati (Facets) and their relationships to Data Gravity (Tiers).

## The Patterns (ADR-008)

### 1. Pre-emptive Hydration
To eliminate "Hydration Races" with the Stratographer, this bundle performs **Atomic Registration** of its Alpine store and render listeners *before* awaiting the asynchronous D3.js engine import. This ensures the optical engine is "Listening" from the first millisecond of the boot sequence.

### 2. Spatial Handshake (ResizeObserver)
The rendering engine utilizes a `ResizeObserver` to intelligently wait for the Flow Stage layout to settle. The simulation only ignites once a non-zero, integer-based dimension is achieved, ensuring the Areal Navigator is perfectly centered.

### 3. State+Space Hash Guard
Rendering is protected by a composite hash of both the physical dimensions (Width/Height) and the multidimensional Stratum state (Perspectives). This prevents infinite loops while guaranteeing instant reactivity to perspective shifts.

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
