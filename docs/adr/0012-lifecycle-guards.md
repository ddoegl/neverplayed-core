# 12. Lifecycle Guards for Persistence Effects

Date: 2026-04-06

## Status

Accepted

## Context

Long-lived components using `Alpine.effect` for global state synchronization can become "Zombie Effects" if not cleaned up after DOM removal. These ghosts can overwrite fresh data with stale local state during global updates.

## Decision

Implement the **Double-Guard Pattern** for all global reactive computations:
1. **Zombie Guard**: Always check if the component is still connected to the DOM (`_isDisconnected`) at the start of any effect.
2. **Hydration Guard**: Ensure synchronization with the source of truth is complete before allowing any persistence (Auto-Save) logic to execute.

## Consequences

*   **Data Integrity**: Prevents "Ghost Overwrites" where old sessions corrupt active data.
*   **Memory Efficiency**: Explicitly destroys reactive computations on `disconnectedCallback`.
*   **Predictability**: Ensures "Last Save Wins" only applies to the active UI instance.
