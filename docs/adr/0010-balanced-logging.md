# 10. Balanced Logging Strategy

Date: 2026-04-06

## Status

Accepted

## Context

Maintaining a clean console is critical for observability, but a "Zero-Console" policy can make early-boot debugging impossible if the log service isn't yet available.

## Decision

Adopt a **Balanced Zero-Console Strategy** using `@pandino/log-service`:
1. Use tagged loggers for all bundle activity.
2. Implement **Safe Early-Boot Fallback**: Initialized variables should default to `console` until the `LOG_SERVICE` is successfully tracked.
3. Use **Lazy Getter Fallback** to re-query the log service for early reactive triggers.

## Consequences

*   **Observability**: High transparency during boot without console noise during runtime.
*   **Resilience**: Logging works regardless of service arrival timing.
*   **Bundle Identification**: Log messages are clearly tagged with the originating bundle symbolic name.
