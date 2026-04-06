# 🌍 Realm: Real Life

The **Real Life Realm** bundle is a specialized domain layer for testing and demonstration. It implements the core "Persona Selection" logic and showcases how realms can manage their own inhabitants.

## 🏛️ Architecture & Implementation

- **Persona Orchestration**: Manages the transition between different user personas (e.g., "Beginner", "Advanced") by hot-patching the `GEMINI.md` constitution and the active flow set.
- **Demo Registry**: provides a set of mock domain objects and actions specific to the "Real Life" scenario.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Inhabitant Layer Sovereignty** (Pattern 6/ADR-0016) and **Realm Fragmentation** (ADR-0006).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Complex Simulations**: Integration with the `PlexusEngine` for real-time domain strategy simulation.
