# 16. Inhabitant Layer Sovereignty

Date: 2026-04-06

## Status

Accepted

## Context

During Realm Transitions, the system uses a "Purge Protocol" to remove orphaned bundles and maintain context purity. However, users often install their own tools (Inhabitant bundles) that should persist across different universes.

## Decision

Establish the **Inhabitant Layer** as a sovereign context protected from the Realm Manager's standard purge logic.

1. **Inhabitant Tracking**: Bundles installed via the `/install` command or explicit UI actions are marked as "Inhabitant" bundles.
2. **Purge Protection**: The `RealmManager` must filter the inhabitant list out of the purge plan during reconciliation.
3. **Manual Management**: Users are responsible for the lifecycle of inhabitant bundles using `/uninstall` or dedicated UI tools.

## Consequences

*   **User Empowerment**: Tools installed by the human citizen (e.g., custom debuggers, personal dashboards) stay active regardless of the active realm.
*   **State Persistence**: Inhabitant lists are persisted across sessions to ensure consistent personal environments.
*   **Conflict Potential**: Conflicting inhabitant bundles (matching BSNs with realm bundles) may lead to non-deterministic behaviour, necessitating a "Universe Wins" override policy.
