# 🪐 Stratum Core Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)

The **Contextual Hub** that aggregates disparate system facets (WHO, WHERE, WHAT, HOW) into a unified, reactive Stratum context.

## 🏛️ Architecture & Implementation

- **Multi-Facet Aggregation**: Connects to the `Session Service`, `Realm Manager`, and `Persistence Manager` to synthesize a complete "Ground Truth" of the system state.
- **Reactive Context**: Exposes a `STRATUM_SERVICE` as a global Alpine.js object, allowing any bundle to react to context shifts in real-time.
- **Canonical URI Generation**: Implements the `toURI()` method to generate linkable, forensic context URIs. Supports `tier` and `flow` shunting. 🛡️🪐
- **URI Perspective Shunting**: Automatically deduces `idealist` vs `realist` stances based on the URI segment structure. 👁️🪐
- **Institutional Persistence Delegation**: Refactors persistence shunting from direct execution to **Delegated Intent**. Pushes `tier` directives to the `Session Service` for atomic synchronization (ADR-0170). 🪐🛡️

## 🏛️ The Patterns (The State)

- **[Platform Patterns](../../docs/platform-patterns.md)**: Implements the **Headless Decoupled Stratum** pattern.
- **[ADR-0165: Sovereign Identity Scoping](../../docs/adr/0165-sovereign-identity-scoping.md)**: Serves as the primary implementation of hierarchical sharding visibility. 🛡️🪐
- **Mechanism**: Uses OSGi Service Trackers to maintain a high-fidelity, decoupled link to infrastructural signals.

## 🚀 Future Road

- **Stratum Inspector UI**: Development of the visual HUD using the core data from this service.
- **Stratum CLI**: Implementation of the `/stratum` command suite for shell-level navigation.
- **Constraint Matrix**: Integrating validation logic to ensure only legal facet combinations are active.

### 🏺 Institutional ADRs
- [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md) - Identity injection ID tokens.
- [ADR-0026](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Reactive non-destructive variable resolution.
- [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0165](../../docs/adr/0165-sovereign-identity-scoping.md) - Sovereign Identity Scoping (Hierarchical Sharding). 🛡️🪐
- [ADR-0170](../../docs/adr/0170-multi-persona-residency.md) - Multi-Persona Identity Residency (Portfolios & Shunting). 🪐🛡️
