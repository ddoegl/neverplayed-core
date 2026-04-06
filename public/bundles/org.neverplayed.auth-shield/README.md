# 🛡️ Auth Shield Bundle

Peripheral bridge for authentication and authorization, primarily integrating with Firebase for identity services.

## 🏛️ Architecture & Implementation

- **Service-Driven**: Registers the `AUTH_SHIELD_SERVICE` as the primary identity provider for the shell.
- **Identity Injection**: Injects `globalThis.NEVERPLAYED_GET_ID_TOKEN()` for cross-bundle authorization (adhering to [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md)).

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Identity Injection** (Pattern 22) and **Constant Compliance** (Pattern 3/ADR-0013).
- **[ADR-0009: Security Naming Convention](../../docs/adr/0009-security-naming-convention.md)**: Enforces the `security.*` prefix for all keys in the `SessionService` to ensure zero-disk persistence.
- **[ADR-0015: Managed Privilege Injection](../../docs/adr/0015-managed-privilege-injection.md)**: Standardizes the injection of claims like `neverplayed-admin` into the shell lifecycle.

### The Security Handshake 🤝
The following hardened authentication flow establishes identity and allows for headless shunting:

```mermaid
sequenceDiagram
    participant Agent as Deno Agent (MCP)
    participant Bridge as Cloud Function (mcpApi)
    participant Auth as Firebase Auth
    participant DB as Firestore (Persistence)

    Note over Agent, Bridge: 1. Identity Handshake
    Agent->>Bridge: POST /mcpApi (Secret + Email)
    Bridge->>Auth: Mint Custom Token (Claim: neverplayed-admin)
    Bridge-->>Agent: Custom Token + UID

    Note over Agent, Auth: 2. Session Establishment
    Agent->>Auth: signInWithCustomToken(Token)
    Auth-->>Agent: Firebase Session + ID Token
```

## 🚀 Future Road

- **Pluggable Providers**: Abstract the Firebase specific logic into a `CREDENTIAL_PROVIDER` service to allow local-only login or OIDC integration.
- **MFA Support**: Integrated multi-factor authentication flows within the Shell UI.
