# 🛡️ System Logger Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Platform-wide logging service that provides a reactive, filtered, and centralized logging infrastructure for all Never Played bundles.

## 🏛️ Architecture & Implementation

- **Service Provider**: Registers a `LOG_SERVICE` (Pandino standard) as defined in `core-types.js`.
- **Reactive Levels**: Uses an Alpine.js global store (`$store.platform.logLevel`) to allow real-time filtering of log output across the entire system.
- **Console Hijacking**: Integrates with the browser console while providing structured metadata (Bundle Name, Level, Timestamp).

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Standardized Logging** (Pattern 19/Pattern 5) for boot-time observability and **Constant Compliance** (ADR-0013).
- **[ADR-0010: Balanced Logging](../../docs/adr/0010-balanced-logging.md)**: Implements the decision to use structured, category-based loggers instead of raw `console.log`.
- **Pattern**: Every bundle activator should retrieve a logger using `logAdmin.getLogger(context.getBundle().getSymbolicName())` to ensure category-to-BSN alignment.

## 🚀 Future Road

- **Remote Persistence**: Add a secondary appender to send critical errors to a centralized dashboard (via `PersistenceSelector`).
- **Telemetry Integration**: Connect log events to the `EventMonitor` for real-time system health visualization.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.


### Referenced Constants:
- `CONFIG_ADMIN_SERVICE`
- `SHELL_CONFIG_PID`
- `SYSTEM_LOGGER_PID`
