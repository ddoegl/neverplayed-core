# org.neverplayed.agent.antigravity 🛰️

![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)

Core Realm resident agent providing autonomous system auditing and institutional recovery for the Never Played ecosystem. 

## 🏛️ The Patterns
This bundle implements the **Agentic Inhabitation** pattern as defined in [ADR-0033](../../docs/adr/0033-agentic-inhabitation-and-institutional-oversight.md). It acts as a bridge between the AI Assistant's reasoning and the live system state.

For core platform standards, see [platform-patterns.md](../../docs/platform-patterns.md).

### Mandatory ADR Compliance
- **Identity**: [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md)
- **Variable Resolution**: [ADR-0026](../../docs/adr/0026-reactive-non-destructive-variable-resolution.md)
- **Versioning**: [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)
- **Sovereignty**: [ADR-0016](../../docs/adr/0016-inhabitant-layer-sovereignty.md)

## 🏛️ Architecture & Implementation
The agent operates as a first-class OSGi resident. It performs periodic (5-minute) architectural scans of the system context.

- **Auditing**: Scans all registered bundles for state anomalies and manifest violations.
- **Remediation**: Authorized to autonomously restart bundles that have fallen into non-active states (`INSTALLED`, `RESOLVED`).
- **Telemetry**: Broadcaster of `AGENT_AUDIT_COMPLETED` events, which trigger the Forensic Bridge for cross-tier synchronization.

### The Patterns (The State)
- **Institutional Sovereignty**: Registered in `core.json` to ensure boot-time presence.
- **Forensic Bridge**: Leverages [ADR-0024](../../docs/adr/0024-dual-mode-persistence-shunting.md) via `persistence-fs-sync`.
- **Reactive UI**: Provides an [AgentIndicator](../../public/bundles/org.neverplayed.shell-header/templates/header.html) integrated into the Shell Header.

## Future Road
- [ ] Implement "Heuristic Recovery" for complex service circular dependencies.
- [ ] Add "Digital Twin" real-time websocket bridge.
- [ ] Multi-agent coordination (Overseer vs Librarian).


### Referenced Constants:
- `AGENT_SERVICE`
- `PERSISTENCE_MANAGER_SERVICE`
- `EVENT_ADMIN_SERVICE`
- `EVENT_FACTORY_SERVICE`
