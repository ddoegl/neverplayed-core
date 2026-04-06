# 7. Realm Transition via Sticky Reconciliation

Date: 2026-04-06

## Status

Accepted

## Context

Switching between Realms (e.g., Personal to Work) involves complex bundle management. Indiscriminately restarting all bundles causes UI flickering and state loss.

## Decision

Implement a **Sticky Reconciliation** strategy during Realm transitions:
- **Set-Based Logic**: Map target manifest bundles against active bundles.
- **SURGE**: New bundles are installed and started.
- **PURGE**: Orphans (bundles currently active but not in the target manifest) are stopped and uninstalled.
- **STICKY**: Identical bundles that are already `ACTIVE` are preserved and skipped to prevent redundant restarts.

## Consequences

*   **Zero Flickering**: Critical infrastructure remains active during context shifts.
*   **Determinism**: Realm state is always reproducible from the manifest.
*   **Semantic Purity**: Purge protocol ensures no "Ghost Services" from previous sessions remain.
*   **Complexity**: Requires mapping Bundles' Symbolic Names (BSN) and precise lifecycle state tracking.
