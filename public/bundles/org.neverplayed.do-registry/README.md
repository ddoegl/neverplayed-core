# 🛡️ DO Registry Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Central registry for **Domain Object (DO)** blueprints, providing a unified access point for metadata, schemas, and semantic types.

## 🏛️ Architecture & Implementation

- **Blueprint Repository**: Stores metadata for every recognized domain object in the system.
- **Service Hub**: Registers the `DOMAIN_OBJECT_REGISTRY_SERVICE` and `DOMAIN_OBJECT_INSTANCE_SERVICE`.
- **Action Proxy**: Registers the `ACTION_SERVICE` providing `view` and `delete` handlers for instances.
- **CLI Diagnostics**: Registers `SHELL_COMMAND_SERVICE` providing `do:list` and `do:inspect`.
- **Infrastructure Tracking**: Tracks `PERSISTENCE_MANAGER_SERVICE`, `SESSION_SERVICE`, and `INTERACTOR_SERVICE` to manage stateful lifecycle and confirmations.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Early Boot Registration** (Pattern 20).
- **[ADR-0025: Identity Injection](../../docs/adr/0025-identity-injection-id-tokens.md)**: Governs instance and blueprint identity.
- **[ADR-0027: Semantic Bundle Versioning](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)**: Governs bundle lifecycle.
- **[ADR-0029: Universal Interactor Service](../../docs/adr/0029-universal-interactor-service.md)**: Used for archival confirmations.
- **[ADR-0030: Hybrid Action Architecture](../../docs/adr/0030-hybrid-action-handshake.md)**: Implements the "Silent Archival" handshake.
- **[ADR-0031: Proactive Discovery Orchestration](../../docs/adr/0031-proactive-discovery-orchestration.md)**: Participates in the universe boot-time scan.

## 🚀 Future Road

- **Schema Mirroring**: Automatic UI generation based on JSON Schemas.
- **Cross-Realm Replication**: Support for shared domain objects between realm clusters.
