# 🛡️ Limes UI

The **Limes UI** bundle provides the administrative interface for the **Limes Security Kernel**. it allows system administrators to visualize, test, and edit access strategies in real-time.

## 🏛️ Architecture & Implementation

- **Live Lab**: Implements a "Strategy Sandbox" where permissions can be tested against mock user IDs and runtime contexts without affecting live traffic.
- **YAML Editor Integration**: Bridges the security kernel with the `YAML_EDITOR_SERVICE`, enabling structured editing of complex ABAC strategies.
- **State Partitioning**: Uses `AlpineActivator` to isolate security management state from the main application flow.

### Key Logic
- `testGuard(userId, strategyId, context)`: Invokes the Limes evaluator and returns a visual success/failure report.
- `editLimesStrategy(id)`: Triggers the centralized YAML editor with a save callback that hot-patches the persistence layer.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Managed Privilege Injection** (Pattern 6/ADR-0015) and **Reactive Component Binding** (Pattern 2/ADR-0016).
- **[ADR-0025: Identity Injection & ID Tokens](../../docs/adr/0025-identity-injection-id-tokens.md)**: Governs how the UI displays and manages security tokens.

## 🚀 Future Road

- **Policy Visualizer**: Graphical representation of strategy inheritance.
- **Usage Statistics**: Integration with `SystemLogger` to show heatmaps of granted/denied access per strategy.
