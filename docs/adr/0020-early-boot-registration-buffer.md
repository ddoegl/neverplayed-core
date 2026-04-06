# 20. Early-Boot Registration Buffer

Date: 2026-04-06

## Status

Accepted

## Context

During system startup, internal discovery events (like `REALM_REGISTERED`) may be triggered before the `EventAdmin` service is available or fully tracked. Losing these events during the initial "surge" leads to an incomplete system state.

## Decision

Implement an internal **Registration Buffer** pattern for infrastructure services that announce their presence via events.

1. **Buffering**: Services must buffer early discovery events if the `EventAdmin` service is not yet available.
2. **Service Tracking**: Track the availability of the `EventAdmin` and `EventFactory` services.
3. **Flushing**: Automatically flush the accumulated buffer and broadcast the events once the required messaging services are fully connected.

## Consequences

*   **Message Integrity**: No discovery events are lost during the high-concurrency boot phase.
*   **Race Resilience**: Services are decoupled from the startup order of the messaging infrastructure.
*   **Complexity**: Requires internal state management (buffer array) and explicit tracking logic in core bundles.
