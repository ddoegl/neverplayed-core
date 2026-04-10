# ADR-0030: Hybrid Action Handshake

## Status

Accepted

## Context

Standardizing actions across the Identity Registry and other modules revealed a
tension between raw service methods and interactive UI requirements. Service
methods should be "clean" and programmatic (executable via CLI or scheduled
tasks), while UI actions often require destructive confirmation or multi-step
hydration. Mixing these concerns leads to "Ghost Methods" (methods that fail
because they require a DOM context) or "Insecure automation" (destructive
methods that execute without guardrails).

## Decision

We establish the "Hybrid Action Handshake" pattern to segregate logic from
interaction:

1. **Silent Logic (Service Layer)**: Core service methods (e.g.,
   `archiveBlueprint(id)`) MUST remain "Silent". They perform the internal state
   transition logic and dispatch any necessary system events. They do NOT
   implement user interaction.
2. **Interactive Gatekeeper (Application Layer)**: The application-level action
   handler (e.g., Alpine store `handleAction`) acts as the gatekeeper. It
   manages the user interaction flow (using the `InteractorService`) and only
   invokes the "Silent Logic" upon successful affirmation.
3. **Implicit vs. Explicit Interactivity**: Services MAY accept an `options`
   object (e.g., `{ interactive: true }`) to bridge this gap, allowing the
   service itself to await an interactor if explicitly requested, while
   defaulting to silent execution for programmatic callers.

## Consequences

- **Automation Friendly**: Services remain fully operable via CLI or script
  without "interaction blocking".
- **Enhanced Safety**: UI destructive actions are guarded by a consistent
  interaction model.
- **Clearer Responsibility**: Separates the "How to delete" (Logic) from the "Is
  it okay to delete?" (Policy).
