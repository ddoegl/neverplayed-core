# 🛡️ System Reset Bundle
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green)


Emergency utility for clearing all persistent state and resetting the kernel to a pristine "guest" state.

## 🏛️ Architecture & Implementation

- **Atomic Purge**: Iteratively calls `PersistenceSelector.clear()` for all registered tiers (Cloud, Browser, Memory).
- **Service Cleanup**: Explicitly stops all bundles and unregisters all services before clearing.
- **Reboot Trigger**: Force-reloads the page to restart the `Shielding` phase.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Strategic Data Shunting** (Pattern 7) for atomic purging and the **Transition Reconciliation** protocol (ADR-0007).
- **[ADR-0007: Realm Transition Reconciliation](../../docs/adr/0007-realm-transition-reconciliation.md)**: Uses the "Purge Protocol" to discard all active context before reset.

## 🚀 Future Road

- **Soft Reset**: Option to only reset the current realm while keeping global session data intact.
- **Rollback Points**: Support "Undo Reset" using a snapshot stored temporarily in the Volatile tier.

### 🏺 Institutional ADRs
- [ADR-0001](docs/adr/0001-centralized-architectural-constants.md) - Project metadata governance.
- [ADR-0025](docs/adr/0025-identity-injection-id-tokens.md) - Global identity injection and ID tokens.
- [ADR-0026](docs/adr/0026-reactive-non-destructive-variable-resolution.md) - Non-destructive variable resolution.
- [ADR-0027](docs/adr/0027-semantic-bundle-versioning-strategy.md) - Semantic versioning for bundles.
- [ADR-0028](docs/adr/0028-tiered-bundle-testing-strategy.md) - Tiered bundle testing strategy.
