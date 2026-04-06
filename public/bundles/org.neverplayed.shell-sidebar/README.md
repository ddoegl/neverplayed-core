# 🛡️ Shell Sidebar Bundle

Left-hand side navigation panel for switching between flows, managing realms, and accessing system-level settings.

## 🏛️ Architecture & Implementation

- **Service Registry Integration**: Tracks `FLOW_SERVICE` and `REALM_SERVICE` to dynamically generate navigation links.
- **State Integration**: Uses `$store.realmManager` to highlight the current active universe and its inhabitants.
- **Visual Feedback**: Utilizes Tailwind animations for expansion and indicator transitions.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Reactive State Synchronization** (Pattern 1) and **Navigation Stability** (Pattern 15/ADR-0011).
- **[ADR-0011: Navigation Stability](../../docs/adr/0011-navigation-stability.md)**: Ensures that the navigation framework is persistent and reactive during realm transitions.

## 🚀 Future Road

- **Pinned Flows**: Allow users to pin frequently used flows to the top of the sidebar.
- **Mini-Analytics**: Inject small sparklines into sidebar items to show activity indicators in real-time.
