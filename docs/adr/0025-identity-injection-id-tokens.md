# ADR-0025: Identity Injection and ID Tokens

## Status
Accepted

## Context
Cross-bundle operations (like Persistence Shunting) require a valid Firebase ID token to authorize requests to the Cloud Bridge. However, the `SessionService` and `AuthShield` manage identity, while lower-level persistence bundles perform the requests. Hardcoupling these produces circular dependencies.

## Decision
We will use a **Global Identity Injection** pattern to provide ID tokens across bundle boundaries:

1. **ID Token Getter**: The `AuthShield` (or Shell) will inject a global async helper `globalThis.NEVERPLAYED_GET_ID_TOKEN()` into the runtime environment.
2. **Decoupled consumption**: Resource-providing bundles (e.g., `persistence-firebase`) will attempt to call this helper whenever they need an `x-mcp-token` header.
3. **Claim Mapping**:
   - `neverplayed-admin` (Custom Claim) is mapped from the `isSuperuser` identity flag.
   - `realm-admin` (In-app attribute) is scoped to the specific active realm.

## Consequences
- **Positive**: Removes direct dependencies between the `AuthShield` and persistence implementations.
- **Positive**: Simplifies headless agent authentication by using a standard header protocol (`x-mcp-token`).
- **Negative**: Relies on a global variable (`globalThis`), which must be guarded against "Zombie" callbacks during bundle stops.
