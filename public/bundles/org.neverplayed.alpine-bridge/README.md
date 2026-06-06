# 🌉 Alpine OSGi Bridge
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


The **Alpine Bridge** bundle provides the reactive "Glue" that connects the Pandino OSGi Service Registry to the Alpine.js UI layer. It allows HTML templates to react directly to service availability and state changes.

## 🏛️ Architecture & Implementation

- **OSGi Magics**: Injects `$context` and `$service` into the Alpine global scope for ad-hoc service lookups.
- **Reactive Directives**: Implements the `x-service` directive, which automatically tracks a service by its interface ID and injects the proxy into the local component scope.
- **Hot-Swap Resilience**: When an OSGi bundle is restarted or swapped, the bridge automatically re-renders affected Alpine components, ensuring zero-downtime UI updates.

### Usage Example
```html
<div x-data="{ localData: '' }" x-service="org.neverplayed.LogService">
    <button @click="org_neverplayed_LogService.info('Button clicked!')">
        Log Message
    </button>
</div>
```

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Component Binding** (Pattern 2/ADR-0016) and **Reactive State Synchronization** (Pattern 1/ADR-0002).
- **[ADR-0019: Platform Namespace Isolation](../../docs/adr/0019-platform-namespace-isolation.md)**: Ensures that injected service proxies do not conflict with application-level data keys.

## 🚀 Future Road

- **Type-Safe Magics**: Integration with `core-types.js` to provide auto-completion for `$service` identifiers.
- **Directive Scoping**: Support for `x-service.proxy` vs `x-service.direct` to control evaluation overhead.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `SESSION_SERVICE`
