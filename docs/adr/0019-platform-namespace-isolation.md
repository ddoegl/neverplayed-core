# 19. Platform Namespace Isolation

Date: 2026-04-06

## Status

Accepted

## Context

Alpine.js global stores are easily accessible, making them a tempted place to store both infrastructure-level state and application-level data. Mixing these namespaces leads to accidental pollution and makes debugging system-level transitions difficult.

## Decision

Enforce strict segregation of infrastructure state into the **Platform Namespace**.

1. **Alpine Store**: All kernel-level orchestration flags (e.g., `kernelReady`, `bootStatus`) must be stored in `Alpine.store('platform')`.
2. **Policy**: Bundle-level or domain-specific data must never be injected into the platform store.
3. **Usage**: The platform store is the source of truth for the shell's top-level navigation and loader UI.

## Consequences

*   **Namespace Purity**: Prevents application crashes from affecting infrastructure visibility.
*   **Clean Transitions**: Infrastructure states (like realm switching indicators) remain isolated from the data being switched.
*   **Consistency**: Standardized location for all shell-level boot telemetry.
