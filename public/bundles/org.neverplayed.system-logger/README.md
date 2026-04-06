# 🛡️ System Logger Bundle

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
