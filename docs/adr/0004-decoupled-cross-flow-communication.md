# 4. Decoupled Cross-Flow Communication via Modal Signals

Date: 2026-04-06

## Status

Accepted

## Context

Bundles in the OSGi environment often need to request actions from one another without direct dependencies. For example, an embedded dashboard sub-flow might need to request a modal from the host shell.

## Decision

Standardize the **Modal Signal Pattern** using DOM CustomEvents. Embedded sub-flows dispatch events (e.g., `invitation-admin-request-modal`) on their target element with the necessary detail. The Host (Shell) listens for these events globally and manages the UI container (slide-over modal), including late-binding necessary state onto the sub-flow's Alpine proxy.

## Consequences

*   **Decoupling**: Sub-flows don't need UI-specific information about the host.
*   **UI Consistency**: Host maintains control over major UI containers like modals.
*   **Late-Binding Risk**: Requires a `setTimeout` or `nextTick` to ensure the sub-flow's state is ready for late-bound values.
