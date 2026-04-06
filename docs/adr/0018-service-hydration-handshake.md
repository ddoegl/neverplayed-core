# 18. Service Hydration Handshake (`waitReady`)

Date: 2026-04-06

## Status

Accepted

## Context

OSGi service availability does not imply data readiness. A `PersistenceManager` or `RealmManager` may be registered and available for tracking, but its internal state (hydration from index files or cloud storage) may still be in progress.

## Decision

Critical infrastructure services must implement an asynchronous `waitReady()` handshake.

1. **Implementation**: Services exposing state or configuration must provide a `waitReady()` method that returns a promise.
2. **Internal Lock**: The promise resolves only after all internal discovery and hydration tasks are complete.
3. **Handshake**: The shell or orchestrator must `await` the `waitReady()` promise before proceeding with dependent logic.

## Consequences

*   **Zero Race Conditions**: Eliminates "Catch-22" scenarios where a service is used before its data is fully loaded.
*   **Predictable Boot**: Orchestrators can accurately signal when a specific system layer is fully operational.
*   **Service Requirement**: All core infrastructure services are now expected to support the hydration handshake.
