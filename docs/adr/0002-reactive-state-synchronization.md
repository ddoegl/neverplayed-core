# 2. Reactive State Synchronization via `$watch`

Date: 2026-04-06

## Status

Accepted

## Context

Alpine.js reactivity is scoped within its `x-data` component. However, in our system, the Host (Backoffice Shell) often provides a reactive Proxy (`host`) containing the global state. Changing a selection in the Master view (e.g., sidebar) may not automatically trigger a re-render of a Detail view if the Detail view relies on local references established during initialization.

## Decision

We standardize the use of the Alpine.js `$watch` magic property to monitor changes in global state or local selection indices and update internal component references accordingly. This is the preferred method for Master/Detail selection sync across multiple data sources.

## Consequences

*   **Synchronized UI**: Ensures Master/Detail views always reflect the same data state.
*   **Explicit Dependency**: Makes the connection between global state and local views explicit.
*   **Boilerplate**: Requires a `$watch` in the `x-init` block of every component relying on cross-context synchronization.
