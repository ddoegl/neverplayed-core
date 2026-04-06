# 🛡️ System Reset Bundle

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
