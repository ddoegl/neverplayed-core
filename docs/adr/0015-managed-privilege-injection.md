# 15. Managed Privilege Injection

Date: 2026-04-06

## Status

Accepted

## Context

Realms represent localized context with varying security requirements. Hardcoding role checks for specific realms into application code breaks modularity and makes the system difficult to extend.

## Decision

The `RealmManager` serves as the authority for dynamic privilege injection. 

1. **Manifest Configuration**: Realms define required roles in the `privileges` section of their manifest.
2. **Dynamic Resolution**: Upon realm activation, the Manager resolves the current user's global identity against the realm's required roles (e.g., `realm-admins`).
3. **Injection**: The Manager injects role-based attributes (e.g., `realm-admin`) directly into the `SessionService`'s reactive state for the active context.

## Consequences

*   **Modular Security**: Realm-specific roles are defined declaratively in the manifest, not in code.
*   **Surgical Access**: Roles like `realm-admin` only exist within the context of the specific realm.
*   **Late-Join Sync**: The Manager must explicitly track the arrival of the `SessionService` to handle asynchronous boot scenarios.
