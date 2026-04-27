# ADR-0170: Multi-Persona Identity Residency

## Status: Accepted

## Context
Originally, the Never Played OS followed a "Single Persona per Realm" model. Switching identities was a destructive process that overwrote the previous session state. This compromised "Navigational Sovereignty" and made it difficult for users to manage multiple roles (Portfolios of Residency) within a single coordinate Cluster.

## Decision
We establish **Multi-Persona Residency** as a core architectural standard. Identity management is refactored from a flat "Login" model to a "Registry Stack" model.

1.  **Identity Registry (`org.neverplayed.session-service`)**: The session state now maintains a `scopedUsers` map where each entry is an identity stack: `{ [id]: UserObject, __activeId__: string }`.
2.  **Residency Portfolios**: Users can inhabit multiple personas simultaneously within a realm. The UI (Shell Header and Stratographer) must visualize these residents and allow for reactive switching.
3.  **Persistence Conductivity**: The `Session Service` becomes the single source of truth for the **Institutional Persistence Context**. All tier directives (from the URI or CLI) must be shunted to the `Session Service`, which then synchronizes the `Persistence Manager` atomically.
4.  **Non-Destructive Switching**: Switching identities is now a pivot of the `__activeId__` marker rather than a registry wipe.

## Consequences
- **Positive**: Seamless multi-role navigation, durable tier preference across reloads, and absolute atomicity of the persistence context (Tenant + Identity + Tier).
- **Negative**: Increased complexity in session state serialization (requires "Identity Purity Sink" sanitization for guest sessions).
- **Security**: The "Identity Purity Sink" must ensure that sensitive metadata from global tenants is not leaked into the local residency stacks when operating in anonymous tiers.
