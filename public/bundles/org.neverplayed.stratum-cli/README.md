# 🐚 Stratum CLI Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)

The **Sovereign Navigation** suite that provides shell-level diagnostics and movement across the system's multidimensional context.

## 🏛️ Architecture & Implementation

- **Context Inspection**: Implements `/stratum info` to visualize the active intersection of Tenant, Identity, Realm, and Persistence policy.
- **Sovereign Mobility**: Implements **`/stratum jump [uri]`**, allowing an agent to perform a multi-facet context transition in a single transaction. 🛡️🚀
- **URI Forensic**: Provides `/stratum path` to generate canonical `np://` URIs for forensic tracking and linkable state restoration.

## 🏛️ The Patterns (The State)

- **[ADR-0165: Sovereign Identity Scoping](../../docs/adr/0165-sovereign-identity-scoping.md)**: Acts as the primary control surface for hierarchical context management. 🛡️🪐
- **OSGi Service Coordination**: Orchestrates calls across the `Session Service` and `Realm Manager` to achieve deterministic stratum pivots.

## 🚀 Future Road

- **Autocomplete support**: Tab-completion for realm IDs and identity aliases.
- **Jump Validation**: Integration with a "Constraint Matrix" to prevent illegal jumps (e.g., jumping to a production realm with a guest identity).

### 🏺 Institutional ADRs
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0165](../../docs/adr/0165-sovereign-identity-scoping.md) - Sovereign Identity Scoping (Hierarchical Sharding). 🛡️🪐
