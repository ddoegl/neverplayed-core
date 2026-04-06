# 5. Resilient Service Retrieval (On-Demand Lookup)

Date: 2026-04-06

## Status

Accepted

## Context

OSGi race conditions and late-arriving infrastructure services can cause "stale" `null` references if services are looked up only once during a bundle's `start` phase.

## Decision

Avoid storing service references as persistent module or class variables. Instead, implement an on-demand helper (e.g., `getSvc`) within business logic methods to re-query the `BundleContext` every time the service is needed. This is designated as the **Resilient Activator Pattern**.

## Consequences

*   **Robustness**: System is resilient to bundle start-up order and restarts.
*   **Self-Healing**: Consumers automatically pick up new service instances after provider updates.
*   **Testability**: Context-based lookups are easier to mock than module globals.
*   **Performance Overhead**: Negligible overhead for service registry lookups in modern engines.
