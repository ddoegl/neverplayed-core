# 🛡️ Event Monitor Bundle

Real-time diagnostic tool for visualizing OSGi service events, lifecycle changes, and EventAdmin signals.

## 🏛️ Architecture & Implementation

- **Event Tracker**: Tracks all OSGi events and stores them in a circular buffer in memory.
- **Micro-UI**: Direct DOM mount for the monitor panel (toggled via hotkey).
- **Reactive Stream**: Uses Alpine.js to update the event stream live as it happens.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Dual-Bridge Reactivity** (Pattern 6/ADR-0004) to monitor both background and foreground signals.
- **[ADR-0004: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Proves the effectiveness of the EventAdmin and the decoupling between bundles.

## 🚀 Future Road

- **Replay Protocol**: Record and replay event streams to reproduce race conditions.
- **Direct Filter**: Add the ability to filter by event type or bundle BSN directly in the UI.
