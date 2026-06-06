# 🗣️ Inner Voice Service
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


Domain service that computes a subjective consciousness monologue for active Beings and manages thought compaction (Layer 4.2).

## 🏛️ Architecture & Implementation

This bundle listens to session shifts and mark deposition events, compiles sensory envelopes, and generates thoughts via the local Gemma model.

- **Sensory Envelope Compilation**: Filters visible occupants and stigmergic marks.
- **Morphic Seed Compaction**: Compresses volatile thought histories into a morphic seed upon entering the platonic lobby.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements cognitive thought-monologue streams.
- **[ADR-0004: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Integrates with EventAdmin events for state announcements.

## 🚀 Future Road

- Enhance reflection loops with short-term and long-term memory retrieval.

### 🏺 Institutional ADRs

- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.


### Referenced Constants:
- `INNER_VOICE_SERVICE`
- `LOG_SERVICE`
- `EVENT_ADMIN_SERVICE`
- `EVENT_FACTORY_SERVICE`
- `SESSION_SERVICE`
- `STRATUM_SERVICE`
- `PERSISTENCE_MANAGER_SERVICE`
- `PERCEIVER_SERVICE`
- `LLM_SERVICE`
