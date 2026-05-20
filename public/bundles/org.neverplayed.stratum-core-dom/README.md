# 🪐 Stratum Core DOM Adapter Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)

The **DOM/UI Reactivity Bridge** that maps the headless `Stratum Core` state to the reactive Alpine.js store (`$store.stratum`), allowing browser components to react to context shifts in real-time.

## 🏛️ Architecture & Implementation

- **Alpine.js Store Binding**: Registers a global Alpine store named `stratum` that tracks critical facets: `tenantId`, `identityId`, `realmId`, `tier`, `perspective`, `inhabitants`, and `residents`.
- **Headless Service Synchronization**: Tracks the active `STRATUM_SERVICE` instance and dynamically binds it to the Alpine store.
- **Event-Driven Reactivity**: Implements the `EventHandler` interface and registers for the `STRATUM_CHANGED_TOPIC` (`org/neverplayed/stratum/CHANGED`) to trigger reactivity updates when the Stratum context changes.

## 🏛️ The Patterns

- **[Platform Patterns](../../docs/platform-patterns.md)**: Implements the **Reactive UI & Interaction** pattern for synchronizing headless OSGi services with the browser's DOM/Alpine.js state.
- **Service Dependency**: Declares its dependency on `@pandino/event-admin/EventHandler` and `org.neverplayed.stratum.StratumService` (tracked dynamically).

### 🏺 Institutional ADRs
- [ADR-0002](../../docs/adr/0002-reactive-state-synchronization.md) - Reactive State Synchronization.
- [ADR-0022](../../docs/adr/0022-bundle-manifest-specification.md) - Bundle Manifest Specification.
- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.
- [ADR-0025](../../docs/adr/0025-decoupled-stratum-ui.md) - Decoupled Stratum UI.
- [ADR-0026](../../docs/adr/0026-headless-context-sovereignty.md) - Headless Context Sovereignty.
- [ADR-0027](../../docs/adr/0027-event-driven-decoupling.md) - Event-Driven Decoupling.
- [ADR-0028](../../docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered Bundle Testing Strategy.

## 🚀 Future Road

- **State Validation**: Add validation controls for UI-triggered login/logout state changes.
- **Micro-Animations**: Trigger transition events in the DOM when the perspective switches.
