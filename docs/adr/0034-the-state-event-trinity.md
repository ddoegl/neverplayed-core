# ADR-0034: The State Event Trinity

**Status:** Accepted

## Context

The Pandino OSGi environment relies heavily on reactive state synchronization
across decentralized bundles. However, three foundational state
events—`pm-context-shifted`, `realm-switched`, and `session-changed`—have
historically been dispatched inconsistently. Some core bundles attempted to
dual-broadcast to both the OSGi `EventAdmin` and the DOM, while others relied
entirely on browser-specific DOM `CustomEvents` bound to `globalThis`.

This inconsistency created architectural blind spots, leading to reactive
desynchronization bugs (e.g., in the Stratographer UI) and fundamentally
violating the headless isolation requirement of pure OSGi services.

## Decision

We formally recognize and standardize "The State Event Trinity" for all reactive
state bindings using the **Core + UI Extender (Adapter) Pattern**.

1. **The Headless Core Mandate:** Core state bundles (e.g., `session-service`,
   `realm-manager`) MUST remain completely headless and environment-agnostic.
   They are strictly prohibited from interacting with the DOM (`globalThis`).
   They MUST dispatch state changes exclusively via the OSGi `EventAdmin`
   service using standardized topics:
   - `PERSISTENCE_CONTEXT_CHANGED_TOPIC` (The "How" / Physical)
   - `REALM_CHANGED_TOPIC` (The "Where" / Logical)
   - `SESSION_CHANGED_TOPIC` (The "Who" / Identity)

2. **The UI Adapter Mandate:** UI augmentation and DOM bridging MUST be handled
   by dedicated extender bundles (e.g., `session-service-dom`,
   `realm-manager-dom`). These adapter bundles register OSGi `EventHandler`
   services to listen to the core topics. They are exclusively responsible for
   translating headless OSGi dictionaries into rich DOM `CustomEvents`
   (`pm-context-shifted`, `realm-switched`, `session-changed`), ensuring
   Alpine.js receives optimized, reactive payloads.

**Rule of Total Synchronization:** Any UI component attempting to represent the
"total state" of the system (e.g., Stratum Core, Stratographer) MUST bind to all
three DOM events. Headless system-level trackers MUST bind to all three OSGi
topics.

## Consequences

- **Positive:** Enforces absolute architectural purity and headless
  compatibility for core services. Core bundles can safely run in pure Node.js
  environments.
- **Positive:** Allows UI adapter bundles to securely handle and optimize rich
  JavaScript payloads (like Alpine reactive proxies) without forcing complex
  serialization through OSGi dictionaries.
- **Positive:** Improves traceability by cleanly separating core state logic
  from UI binding layers.
- **Negative:** Requires creating and maintaining paired `-dom` adapter bundles
  for every core state service, increasing the total bundle count and
  initialization complexity.
