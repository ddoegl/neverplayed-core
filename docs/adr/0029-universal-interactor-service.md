# ADR-0029: Universal Interactor Service

## Status

Accepted

## Context

Across the Never Played platform, various services (e.g., Identity Registry,
Realm Manager) need to interact with the user for affirmations (confirmations)
or notifications (alerts). Historically, these were handled directly via
browser-native APIs (`window.confirm`, `window.alert`) within service methods.
This approach creates tight coupling between business logic and the browser
environment, making it impossible to run the same services in headless CLI
contexts or automated scripts without modifications.

## Decision

We will introduce an abstracted interaction layer via the `INTERACTOR_SERVICE`
(`org.neverplayed.ui.Interactor`).

1. **Service Abstraction**: Business services MUST NOT invoke browser-native
   interaction APIs directly. They must instead track and use the
   `InteractorService`.
2. **Asynchronous Handshake**: All interaction methods (e.g., `confirm()`,
   `prompt()`) MUST be asynchronous (returning Promises). This allows for
   blocking execution in CLI environments (awaiting readline) or UI environments
   (awaiting modal closure).
3. **Environment Agnostic Providers**: The `shared-ui` bundle provides the
   default browser implementation. This can be swapped for a Node/CLI
   implementation in terminal-based environments without changing the consuming
   service logic.

## Consequences

- **Logic Purity**: Service methods like `archiveBlueprint` can remain logically
  pure and transparent while still supporting interactive safety nets.
- **Portability**: Code becomes safe to execute in any environment (Browser,
  CLI, SSR) as long as an appropriate Interactor provider is registered.
- **Implementation Overhead**: Services must now handle asynchronous interaction
  flows, even for simple confirmations.
