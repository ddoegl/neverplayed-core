![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)

The **Persistence Deno LocalStorage** bundle provides a Deno-native implementation of the persistence interface using the `localStorage` API (available in Deno 1.x+).

## 🏛️ Architecture & Implementation

- **Browser-API Compatibility**: Allows Deno-based inhabitants to use the same logic as browser-based inhabitants.
- **Device Scoping**: Stores data in the Deno-managed local storage directory (platform-specific).
- **Discovery Channel**: Implements `listKeys(prefix)` to support domain-wide discovery scans (Rule 27 / SDN-0140). 🔍🛰️

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Strategy** (ADR-0003).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Unified Mocking**: Shared test suite across browser `localStorage` and Deno `localStorage`.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
