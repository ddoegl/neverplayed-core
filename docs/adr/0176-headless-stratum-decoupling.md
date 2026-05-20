# ADR-0176: Headless Stratum Decoupling & DOM Extender

## Context & Problem Statement

The `STRATUM_SERVICE` acts as the aggregate context provider (the "ground truth") for the Never Played OSGi platform, merging user, realm, and persistence configurations. However, its initial implementation was wrapped directly in an `Alpine.reactive` proxy and directly listened to browser DOM globals (`globalThis.addEventListener`). 

This created serious architectural issues:
1.  **Headless Execution Failures**: Headless runners (like Deno unit tests or Node CLI scripts) do not possess a DOM context, causing import-time crashes when Alpine.js attempts to access browser APIs (`ReferenceError: MutationObserver is not defined`).
2.  **Reactivity Cascades**: Nesting reactive dependencies from different bundles (`session-service` -> `stratum-core` -> UI) triggers massive fan-in/fan-out cascades, resulting in infinite update loops and memory leaks.
3.  **Violation of ADR-0034**: ADR-0034 mandates that core services must remain completely headless and communicate only via OSGi `EventAdmin` topics.

## Proposed Decision

We formally decouple the Stratum Core architecture into a pure, headless OSGi service accompanied by a dedicated DOM adapter bundle:

1.  **Headless Core Service (`org.neverplayed.stratum-core`)**:
    *   **No Alpine Imports**: The bundle must use pure JavaScript/ES6 class syntax. No Alpine.js references or imports are allowed.
    *   **OSGi Topic Ingress**: The service listens to standard OSGi EventAdmin topics (`SESSION_CHANGED_TOPIC`, `REALM_CHANGED_TOPIC`, `PERSISTENCE_CONTEXT_CHANGED_TOPIC`) instead of DOM events.
    *   **Debounced Batching**: Upstream change events are batched into a microtask loop (using `Promise.resolve()`) before executing expensive scans like `getInhabitants()`. This limits the fan-in/fan-out update frequency.
    *   **OSGi Event Egress**: When its internal properties shift, the core service publishes a consolidated change notification via OSGi EventAdmin on the topic `org/neverplayed/stratum/CHANGED`.

2.  **UI Companion Extender (`org.neverplayed.stratum-core-dom`)**:
    *   **Reactivity Bridge**: A dedicated adapter bundle that tracks the headless `STRATUM_SERVICE`.
    *   **Centralized Reactive Store**: It listens to the `org/neverplayed/stratum/CHANGED` OSGi topic and updates a centralized Alpine.js global store (`$store.stratum`).
    *   **DRY UI Bindings**: Consuming UI components (`shell-header`, `stratographer`) read directly from `$store.stratum` instead of writing individual tracking and bridging code.

## Consequences

*   **Positive**: Restores complete headless compatibility, allowing the entire core OSGi stack to boot and run inside Deno/Node test runners without polyfills.
*   **Positive**: Solves reactive recursion and cascade loops by introducing a batched microtask queue between source updates and stratum state changes.
*   **Positive**: Adheres to DRY principles by centralizing the Alpine.js binding layer in a single, reusable store.
*   **Negative**: Increases the total bundle count by introducing a companion `-dom` adapter bundle.

## Status

Accepted

## Date

2026-05-20
