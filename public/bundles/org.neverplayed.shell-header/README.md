# 🛡️ Shell Header Bundle

Top-level UI navigation and status bar, providing centralized access to identity management, session awareness, and global search.

## 🏛️ Architecture & Implementation

- **Direct UI Mount**: Targeted mounting to the `#shell-header` ID via CSS selector (as defined in `manifest.json`).
- **Reactive Visibility**: Uses `$store.platform.kernelReady` and `$store.session.currentUser` for dynamic content rendering.
- **Micro-interactons**: Implements smooth transitions for user profile modals and search overlays.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Multi-Phase Boot** (Pattern 2/ADR-0014) and **Platform Namespace Isolation** (Pattern 3/ADR-0019).
- **[ADR-0014: Multi-Phase Boot](../../docs/adr/0014-multi-phase-boot.md)**: Standardized visibility using the `kernelReady` state to prevent flashing of unstyled/unhydrated content.
- **[ADR-0019: Platform Namespace Isolation](../../docs/adr/0019-platform-namespace-isolation.md)**: Respects the segregation of shell internal telemetry and application-specific session data.

## 🚀 Future Road

- **Dynamic Extension Points**: Support "Header Inhabitant" services to allow realms to inject their own buttons and dropdowns into the bar.
- **Breadcrumb Navigator**: Add a reactive breadcrumb path connected to the `RealmManager`'s current context.
