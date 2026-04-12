# ADR-0140: Sovereign Shield (Domain Object Security)

## Status
Accepted

## Context
The Never Played project is evolving into a multi-user environment where Domain Objects (DOs) must be isolated based on user identity. Previously, DOs were globally visible and collectively managed, leading to a lack of privacy and security risks in shared realms. 

We need a robust, identity-aware framework that enforces ownership from creation through discovery to archival, without sacrificing the reactive and decoupled nature of the OSGi system.

## Decision
We implement the **Sovereign Shield** architecture, which establishes three levels of identity-aware protection:

1.  **Identity Injection (Progenitor Stamping)**:
    *   The `Shared Domain Strategies` layer now tracks the global `SESSION_SERVICE`.
    *   Every new instance created via `createInstance` is indelible stamped with the `ownerId` from the current session.
    *   Ownership is immutable after creation.

2.  **Sovereign Filtering (Identity-Aware Discovery)**:
    *   The `DO-Registry` implements a gated discovery loop in `refreshMaster`.
    *   Instances with a foreign `ownerId` are skipped during hydration, ensuring they never enter the local session's memory or reactive state.
    *   A reactive **Identity Observer** (via Alpine.js store effects) automatically clears the discovery cache and triggers a re-scan whenever the `currentUser` shifts.

3.  **Archival Blockade (Ownership Guard)**:
    *   The `removeInstance` operation in the Registry is hardened with a **Load-on-Guard** mechanism.
    *   Even if an ID is accessed directly, the Registry loads the object from the Persistence Manager to verify ownership before permitting deletion.

4.  **Sovereign Bridge**:
    *   The `Auth Shield` is bridged to the `SESSION_SERVICE` to propagate authenticated identities.
    *   A `headless-user-provided` pulse is established to support zero-config identity hot-swapping in TDD environments.

## Consequences
*   **Multi-User Isolation**: Users are 100% isolated from each other's private Domain Objects.
*   **Security Gaps Closed**: Unauthorized deletion attempts are blocked at the persistence interface.
*   **Reactive Security**: Identity shifts result in "self-healing" UI states where data instantly vanishes/re-appears based on the new session.
*   **TDD Reliability**: Secure multi-user flows can now be verified in headless environments using the unified event loop.

## Compliance
All future Domain Object strategies and registry extensions MUST adhere to this identity-stamping pattern and use the Registry's gated discovery interfaces.
