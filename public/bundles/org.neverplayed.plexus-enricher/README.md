# 🧠 Plexus Enricher
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


Enriches active perceptions by aggregating details from dynamic domain capability providers.

## 🏛️ Architecture & Implementation

This bundle listens to registered `KnowledgeProvider` services and merges their dynamically evaluated senses into the perceiver context before execution.

- **Dynamic Enrichment**: Expands raw context representation dynamically.
- **Unified Interface**: Exposes the `org.neverplayed.plexus.PlexusEnricherService` capability.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements context-driven perceptual enrichment.
- **[ADR-0017: Contextual Provider Injection](../../docs/adr/0017-contextual-provider-injection.md)**: Enables dynamically registered providers to contribute senses.

## 🚀 Future Road

- Support asynchronous enrichment queries with timeout bounds.

### 🏺 Institutional ADRs

- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.

- [ADR-0025](../../docs/adr/000025-...)
- [ADR-0026](../../docs/adr/000026-...)
- [ADR-0027](../../docs/adr/000027-...)

### Referenced Constants:
- `PLEXUS_ENRICHER_SERVICE`
- `LOG_SERVICE`
