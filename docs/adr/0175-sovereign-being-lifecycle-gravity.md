# ADR-0175: Sovereign Being Lifecycle & Focus Gravity

## Context & Problem Statement

In a multi-realm OSGi architecture, identities often become "trapped" within
specific realm silos. When a user transitions between realms (e.g., Habitat to
Governance), the system historically defaulted back to "GUEST" because the
identity context was local to the origin realm. We need a mechanism that allows
an identity to "carry over" across realms while maintaining its distinct focus.

## Proposed Decision

We implement the **Sovereign Being** pattern, which introduces three core
mechanisms:

1. **Being Gravity**: When an identity is activated in any local realm, it is
   automatically promoted to the session-wide `activeBeingId` (the Focus). This
   focus exerts a "gravitational pull" that keeps the identity active even when
   the navigational coordinate (Realm) changes.
2. **Global Identity Anchoring**: All logins, regardless of their target scope,
   must be "anchored" in the `global` session scope. This ensures that the
   global identity registry can always resolve the current Being's metadata
   during cross-realm Materialization lookups.
3. **Being Dissolution**: Upon logout (Resident Exit), the system must
   explicitly clear the `activeBeingId`. This ensures that the "Soul" (Being) is
   detached from the "Vessel" (Session), allowing for a clean transition back to
   a Guest or a different identity.

## Consequences

- **Positive**: Consistent identity experience across Stratum Jumps; no more
  "fallback to GUEST" anomalies.
- **Positive**: Simplified UI templates using a single `$session.currentUser`
  magic property.
- **Negative**: Increased complexity in the `SessionService` to manage
  cross-scope upserts.
- **Neutral**: Requires all UI bundles to subscribe to the global `$session`
  rather than local user stores.

## Status

Accepted

## Date

2026-05-02
