# 🦕 Deno Filesystem Persistence

![Documentation Health](https://img.shields.io/badge/Documentation-Health-green)

The **Persistence Deno** bundle is the server-side implementation of the `PersistenceManager` for the Deno runtime. It provides direct filesystem persistence for headless agents and the local development server.

## 🏛️ Architecture & Implementation

- **Atomic FS Ingress**: Maps `load()` and `store()` calls directly to the local filesystem (typically `public/.neverplayed/state.json`).
- **Discovery Pulse**: Implements `listKeys(prefix)` to support aggregated key discovery across tiers.
- **Standalone Model**: Operates without a browser context, serving as the primary persistence provider for CLI and background automation tools.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Strategy**.
- **[ADR-0152: Discovery-Driven Persistence Aggregation](../../docs/adr/0152-discovery-driven-persistence-aggregation.md)**: Implements the `listKeys` contract to participate in deep scans performed by the Selector.
- **[ADR-0003: Tiered Persistence Strategy](../../docs/adr/0003-tiered-persistence-strategy.md)**: Stores data in the `local` tier with a `device` scope.

## 🚀 Future Road

- **Encrypted Storage**: Integration with `LimesExt` for automated encryption-at-rest.
- **Stream-Based I/O**: Refactor to use streaming for massive state files.

### 🏺 Institutional ADRs

- [ADR-0151](../../docs/adr/0151-resilient-persistence-sovereignty.md) - Resilient Persistence Sovereignty.
- [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic Versioning.
