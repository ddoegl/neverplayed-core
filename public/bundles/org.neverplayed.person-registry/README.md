# 👥 Person Registry Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Initial-amber)

The **Institutional Identity Hub** that manages the registration of physical Persons and enforces cross-bundle governance through reactive capability enrichment.

## 🏛️ Architecture & Implementation

- **Institutional Privilege Guard**: Integrates with the `LIMES_SERVICE` to enforce strict visibility controls on the Person Registry flow (SDN-0175).
- **Reactive Capability Enrichment**: Uses an `Alpine.effect` to proactively inject domain-specific privileges (`isPersonAdmin`, `isRegisteredPerson`) into the active session identity.
- **YAML Data Authority**: Uses `data/persons.yaml` as the canonical source of truth for person data and authorization mappings.

## 🏛️ The Patterns (The State)

- **[Sovereign Identity Scoping (ADR-0165)](../../docs/adr/0165-sovereign-identity-scoping.md)**: Adheres to the hierarchical sharding principles for identity management.
- **[Institutional Privilege Control](../../docs/platform-patterns.md)**: Implements the "Limes Guard" pattern for reactive UI visibility.

## 🚀 Future Road

- **Self-Service Onboarding**: Implement an invitation flow for new inhabitants.
- **Audit Trails**: Integrate with the system logger to track administrative changes.

### 🏺 Institutional ADRs
- [ADR-0025](../../docs/adr/0025-architectural-integrity.md) - Architectural Integrity. 🛡️
- [ADR-0026](../../docs/adr/0026-governance-standards.md) - Governance Standards. 🛡️
- [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic Versioning. 🛡️
- [ADR-0165](../../docs/adr/0165-sovereign-identity-scoping.md) - Sovereign Identity Scoping. 🛡️🪐
- [ADR-0175](../../docs/adr/0175-sovereign-being-lifecycle-gravity.md) - Sovereign Being Lifecycle & Focus Gravity. 🧬✨


### Referenced Constants:
- `FLOW_SERVICE`
- `PERSONS_SERVICE`
- `PERSISTENCE_RESOLVER_SERVICE`
- `PERSISTENCE_MANAGER_SERVICE`
- `YAML_SERVICE`
- `YAML_EDITOR_SERVICE`
- `SESSION_SERVICE`
- `KNOWLEDGE_PROVIDER_SERVICE`
- `PERSONS_PID`
