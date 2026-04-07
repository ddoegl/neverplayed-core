# 🛡️ Shared Domain Strategies Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Global repository for domain-specific business logic patterns and strategy services.

## 🏛️ Architecture & Implementation

- **Strategy Engine**: Implements the strategy design pattern for common domain operations (e.g., identity validation, calculation rules).
- **Shared Access**: Provides a set of "Utility Behaviors" that can be used by both backoffice and user flows.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Constant Compliance** (Pattern 3/ADR-0013) and **Early Boot Registration** (Pattern 20/ADR-0020).
- **[ADR-0020: Early Boot Registration Buffer](../../docs/adr/0020-early-boot-registration-buffer.md)**: Ensures that foundational strategies are buffered and captured during high-throughput booting.
- **[ADR-0013: Layered Architectural Constants](../../docs/adr/0013-layered-architectural-constants.md)**: Ensures consistent strategy PIDs for cross-layer lookups.

## 🚀 Future Road

- **Dynamic Strategy Injection**: Allow realms to provide their own strategy overrides for standard operations.
