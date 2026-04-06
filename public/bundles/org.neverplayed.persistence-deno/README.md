# 🦕 Persistence Deno

The **Persistence Deno** bundle is the server-side implementation of the `PersistenceManager` for the Deno runtime. it provides direct filesystem persistence for headless agents and the local dev server.

## 🏛️ Architecture & Implementation

- **Atomic FS Ingress**: Maps `load()` and `store()` calls directly to `public/.neverplayed/state.json`.
- **Capabilities**: Registers with high service ranking (10) for device-scoped persistence.
- **Standalone Mode**: Does not require a browser context, making it the primary persistence provider for CLI and automation tools.

### Service Metadata
```json
{
    "capability": "sys:persistence",
    "implementation": "deno-fs",
    "persistence.tier": "local",
    "persistence.scope": "device"
}
```

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Strategy** (ADR-0003).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Encrypted Storage**: Integration with `LimesExt` for automated encryption-at-rest of sensitive configuration keys.
