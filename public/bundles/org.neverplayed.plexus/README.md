# 🧬 Plexus Matcher Engine
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


Core Rule & Matcher Evaluation Engine for the Never Played platform, validating beings, surrogates, and capabilities.

## 🏛️ Architecture & Implementation

Plexus evaluates boolean match matrices against the current active perceptual system context. It provides a simple boolean solver supporting standard operator chains (`AND`, `OR`, `NOT`).

- **Deterministic Resolution**: Runs stateless matching rules over complex user states.
- **Unified Engine**: Exposes the `org.neverplayed.plexus.Engine` service for sensor and rule validation.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements standard rule evaluation patterns.
- **[ADR-0012: Lifecycle Guards](../../docs/adr/0012-lifecycle-guards.md)**: Integrates with lifecycle locks and transitions.

## 🚀 Future Road

- Add compilation caching for complex rule logic.

### 🏺 Institutional ADRs

- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.

- [ADR-0025](../../docs/adr/000025-...)
- [ADR-0026](../../docs/adr/000026-...)
- [ADR-0027](../../docs/adr/000027-...)

### Referenced Constants:
- `CONFIG_ADMIN_SERVICE`
- `PLEXUS_ENGINE_SERVICE`
- `PLEXUS_PID`
- `LOG_SERVICE`
- `PERCEIVER_SERVICE`
- `PLEXUS_ENRICHER_SERVICE`
- `PLEXUS_EVALUATOR_SERVICE`
- `KNOWLEDGE_PROVIDER_SERVICE`
