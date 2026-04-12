# Domain Object Registry 🏺🏛️

![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)

Central registry for **Domain Object (DO)** blueprints, providing a unified
access point for metadata, schemas, and semantic types.

## 🏛️ Architecture & Implementation

- **Blueprint Repository**: Stores metadata for every recognized domain object
  in the system.
- **Service Hub**: Registers the `DOMAIN_OBJECT_REGISTRY_SERVICE` and
  `DOMAIN_OBJECT_INSTANCE_SERVICE`.
- **Action Proxy**: Registers the `ACTION_SERVICE` providing `view` and `delete`
  handlers for instances.
- **CLI Diagnostics**: Registers `SHELL_COMMAND_SERVICE` providing `do:list` and
  `do:inspect`.
- **Infrastructure Tracking**: Tracks `PERSISTENCE_MANAGER_SERVICE`,
  `SESSION_SERVICE`, and `INTERACTOR_SERVICE` to manage stateful lifecycle and
  confirmations.
- **Atomic Purge Protocol**: Implements the `purgeBlueprint(id)` method to 
  guarantee atomic cascading liquidation of blueprints and orphaned instances 
  with a singular `sync()` pulse. 🏛️⚡
- **Discovery Shield**: Implements a transient **Liquidated Graveyard** and 
  debounced hydration to prevent "Ghost Re-Hydration" from laggy persistence 
  snapshots (Pattern 12). 🛡️🪦
- **Sovereign Filtering**: Gated discovery logic that ensures users only hydrate 
  Domain Objects they own (ADR-0140). 🛡️👤
- **Superuser Sight**: Administrative bypass for `realm-admin` users. Toggling the
  **showAllDOs** state explicitly triggers a `refreshMaster` pulse to
  re-hydrate discovery across all users. 🏛️🔭
- **Owner Forensics**: Surface-level metadata visibility in the UI. Injects an
  `ownerId` mono-badge into instance cards for administrative audit. 🔭🏷️
- **Archival Blockade**: Mandatory ownership verification for instance removal. 
  Blocked liquidation attempts from non-owners via **Load-on-Guard** checks. 🧱🚫
- **Identity Observer**: Reactive re-scan logic that invalidates the local cache 
  and re-hydrates discovery whenever the global session identity shifts. 🛰️🔄

## 🏛️ The Patterns (The State)

- **[Pattern 12: Discovery Shield](../../docs/platform-patterns.md)**: 
  Implements a transient **Liquidated Graveyard** to suppress re-hydration of 
  ghost entries during cloud sync. 🪦🛡️
- **[Pattern 20: Early Boot Registration](../../docs/platform-patterns.md)**:
  Implements **Early Boot Registration** (Pattern 20).
- **[Rule 22: Strict Stand-alone Filtering]**: Only hydrates buckets matching
  the individual instance pattern, ignoring legacy collective maps. 🏺🛡️
- **[ADR-0032: Lexical Key Ordering](../../docs/adr/0032-lexical-key-ordering-standard.md)**:
  Governs sequence authority for Steps and Parts.
- **[ADR-0025: Identity Injection](../../docs/adr/0025-identity-injection-id-tokens.md)**:
  Governs instance and blueprint identity.
- **[ADR-0026: Reactive Variable Resolution](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md)**:
  Governs non-destructive variable resolution across reactive states.
- **[ADR-0027: Semantic Bundle Versioning](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)**:
  Governs bundle lifecycle.
- **[ADR-0029: Universal Interactor Service](../../docs/adr/0029-universal-interactor-service.md)**:
  Used for archival confirmations.
- **[ADR-0030: Hybrid Action Architecture](../../docs/adr/0030-hybrid-action-handshake.md)**:
  Implements the "Silent Archival" handshake.
- **[ADR-0140: Sovereign Shield](../../docs/adr/0140-sovereign-shield.md)**:
  Governs multi-user isolation, identity restoration, and archival blockades. 🛡️👤
- **[ADR-0031: Proactive Discovery Orchestration](../../docs/adr/0031-proactive-discovery-orchestration.md)**:
  Participates in the universe boot-time scan.

## 🚀 Future Road

- **Schema Mirroring**: Automatic UI generation based on JSON Schemas.
- **Cross-Realm Replication**: Support for shared domain objects between realm
  clusters.
