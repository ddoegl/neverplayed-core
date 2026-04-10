# ADR-0031: Proactive Discovery Orchestration

## Status

Accepted

## Context

Initial implementations of the `Atomic Orchestrator` relied solely on reactive
OSGi bundle listeners (`context.trackBundles()`). This created a significant
"Boot-time Blind Spot" where any bundle that transitioned to the `ACTIVE` state
_before_ the Orchestrator started was never ingested into the Atomic map. This
led to critical UI regressions, such as infrastructure domain objects (e.g.,
`about-do-registry`) missing from the registry view unless manually refreshed.

## Decision

We establish the "Proactive Discovery Orchestration" pattern to ensure system
state consistency at boot:

1. **Mandatory Boot-Time Scan**: Upon starting (`onStart`), the Orchestrator
   MUST invoke a full `runRefresh()` discovery cycle.
2. **Exhaustive Discovery**: The discovery cycle MUST iterate over all currently
   active bundles (`context.getBundles()`), local storage artifacts, and static
   domain objects.
3. **Reactive Fallback**: The Orchestrator continues to use reactive listeners
   for _future_ transitions, but the initial state is always established via
   proactive scanning.
4. **Resonant Refresh Action**: The internal discovery logic SHOULD be shared
   with a public action/command (e.g., `atomic:refresh`) to ensure consistency
   between boot-time and manual discovery.

## Consequences

- **Elimination of Race Conditions**: Boot-order no longer affects system state
  correctness regarding Atomic specs.
- **Higher Resource Utilization**: A project-wide bundle scan is performed once
  at boot, but this is negligible compared to the stability benefits.
- **Improved Observability**: The system starts in a known-complete state,
  allowing for more reliable diagnostic reporting.
