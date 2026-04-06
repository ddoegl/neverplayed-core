# 14. Multi-Phase Orchestrated Kernel Boot

Date: 2026-04-06

## Status

Accepted

## Context

Initialization of a complex, decoupled OSGi environment in the browser can lead to unpredictable system states if performed procedurally. Race conditions between core services (Auth, Persistence) and the UI Shell can cause intermittent failures during the boot sequence.

## Decision

The system entrypoint (`realms-secure.html`) must follow a strict, multi-phase kernel boot sequence managed by a centralized orchestrator:

1. **Shielding Phase**: Core initialization of the Pandino kernel and foundational bundles (Event Admin).
2. **Orchestration Layer**: Installation and startup of the `RealmManager` to handle universe resolution.
3. **Diagnostics Layer**: Activation of monitoring tools (Alpine Inspector).
4. **Handshake Phase**: Waiting for critical infrastructure services to signal readiness via `waitReady()`.

## Consequences

*   **Determinism**: Ensures the system is in a known, stable state before the UI is interactive.
*   **Observability**: Provides clear boot-status milestones for user feedback.
*   **Startup Latency**: Slight increase in boot time due to synchronized phase transitions.
