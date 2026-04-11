# ADR-0033: Agentic Inhabitation and Institutional Oversight

## Status
Proposed

## Context
As the Never Played system grows in complexity, there is a need for autonomous, institutional oversight that can monitor system health, detect architectural drift, and perform self-healing recovery cycles without direct user intervention. Furthermore, there is a need for a bridge between the AI Assistant (Antigravity) and the live system state to enable real-time architectural guidance and "Shadow Perception" of the browser's runtime context.

## Decision
We will implement the **Agentic Inhabitation** pattern. 

1. **Institutional Residents**: Agents (like Antigravity) will be deployed as standard OSGi bundles (`org.neverplayed.agent.*`) and registered in the **Core Realm** (`core.json`). This makes them native foundations of any system boot.
2. **Autonomous Recovery**: Agents are authorized to perform state-correction logic (e.g., restarting `INSTALLED` bundles) via the standard `Bundle.start()` API.
3. **Institutional Telemetry (Forensic Bridge)**:
    - Agents will perform periodic architectural audits (default: 5 mins).
    - Findings will be persisted to dedicated storage buckets (`realm.agent.*`).
    - The `persistence-fs-sync` bridge will be extended to synchronize these buckets from the browser to the filesystem (`state.json`), enabling "Forensic Observation" by the AI Assistant.
4. **Agentic Indicators**: The Shell UI will provide a reactive visual signal (pulsing satellite) to indicate the resident's presence and health status.
5. **Real-Time Bridge (MCP)**: The Model Context Protocol (MCP) server will expose specialized tools (`antigravity_get_audit_report`) to the AI Assistant, using the Forensic Bridge as the source of truth for "Resident Perception."

## Consequences

### Positive
- **Self-Healing**: The system can automatically recover from common runtime failures (crashed bundles).
- **Architectural Guidance**: The AI Assistant can see the "Live Soul" of the browser via the Forensic Bridge, allowing for more precise debugging and pair-programming.
- **Institutional Memory**: Audit logs provide a historical record of system stability and drift.

### Negative
- **Resource Overhead**: Periodic auditing and state synchronization consume minor CPU and I/O cycles.
- **Complexity**: Adds a cross-tier synchronization layer (`localStorage` -> `state.json` -> AI Context).

## Related ADRs
- [ADR-0016: Inhabitant Layer Sovereignty](./0016-inhabitant-layer-sovereignty.md)
- [ADR-0024: Dual Mode Persistence Shunting](./0024-dual-mode-persistence-shunting.md)
- [ADR-0031: Proactive Discovery Orchestration](./0031-proactive-discovery-orchestration.md)
