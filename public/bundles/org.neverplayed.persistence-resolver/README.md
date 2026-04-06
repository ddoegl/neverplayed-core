# 🛡️ Persistence Resolver Bundle

The **Decision Authority** for multi-layered persistence resolution, ensuring that data is shunted accurately between realms and storage providers.

## 🏛️ Architecture & Implementation

- **Resolution Hierarchy**: Implements the logic for resolving which `PersistenceService` to use for a particular key.
- **Layer Mapping**: Connects the 5-layer ontology to specific technical storage PIDs.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Resolution** (Pattern 7/ADR-0003) and **Defensive Fallback** (Pattern 21/ADR-0021).
- **[ADR-0003: Tiered Persistence Strategy](../../docs/adr/0003-tiered-persistence-strategy.md)**: Core logic for tier resolution and fallback management.

## 🚀 Future Road

- **Pluggable Resolvers**: Allow realms to bring their own resolution logic for domain-specific keys.
