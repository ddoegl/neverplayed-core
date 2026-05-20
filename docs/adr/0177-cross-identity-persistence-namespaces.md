# ADR-0177: Cross-Identity Parameterized Persistence Routing

## Context & Problem Statement

Under **[ADR-0165: Sovereign Identity Scoping](../../docs/adr/0165-sovereign-identity-scoping.md)**, key storage in the persistence layer is partitioned by the active session identity. The physical storage key format is:
`np:v1:${tenantId}:${realmId}:${activeIdentityId}:${logicalKey}`

While this ensures strict user data isolation, it creates a boundary lock during administrative or forensic operations. For example, when a registrar persona (like Rob Richter in Governance) needs to query or store sensory status keys (such as `identity.personhood:july`) for another identity, the default key-builder resolves the active observer's ID (`rob`). As a result, July's state is stored under Rob's namespace, causing data fragmentation, look-up failures, and security leaks.

We need a clean, non-intrusive way to route reads/writes to a target identity's namespace when an authorized administrator is performing cross-identity operations.

## Proposed Decision

We formalize the **Cross-Identity Parameterized Persistence Routing** pattern across the persistence tier:

1.  **Identity Route Overrides (`options.identityId`)**:
    *   Extend the signatures of all `PersistenceManager` operations (`load`, `store`, `probe`) to accept an optional `identityId` property inside the `options` argument.
    *   Storage provider implementations (e.g., `persistence-localstorage`) must use `options.identityId` as the primary routing namespace, falling back to `this._context.identityId` (the active user session) only if the option is omitted.

2.  **Selector Interception & Enrichment**:
    *   The `persistence-selector` acts as the gatekeeper. It must intercept structured keys containing target identifiers (e.g., `identity.personhood:<id>`).
    *   Before delegating to physical providers, the selector extracts the target ID and automatically enriches the `options.identityId` parameter. This ensures clean, transparent routing without forcing client bundles to manually construct complex options dictionaries.

3.  **Cross-Identity Key Listing**:
    *   Providers must update `listKeys(prefix)` to query across different identity paths under the active realm when the caller has elevated permissions (e.g. searching across `realmPrefix` namespaces to find other users' files).

## Consequences

*   **Positive**: Maintains strict identity-based namespace isolation while granting authorized roles the ability to query or modify other identities' data.
*   **Positive**: Prevents observers from writing records into their own local namespaces when assessing other resident nodes.
*   **Negative**: Introduces basic regex/parsing overhead in the `persistence-selector` to detect structured keys.
*   **Neutral**: Requires that any bundle managing multi-user data follow naming conventions (e.g. `domain.subdomain:targetId`) so the selector can route them correctly.

## Status

Accepted

## Date

2026-05-20
