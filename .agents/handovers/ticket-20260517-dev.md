---
from: ana
to: dev
date: 2026-05-17T15:24:30+02:00
subject: Implement Stratographer UI Fix & Core UI Adapters
---

# Handover Ticket: Stratographer Reactivity & Adapter Architecture

**From:** Forensic Analyst (ana)
**To:** Development Engineer (dev)

## Context
During the forensic audit of the Stratographer Dashboard, we discovered a major reactive desync bug. The environment toggles (like *habitat* and *showcase*) fail to highlight on click because the `stratographerDashboard` Alpine component relies exclusively on the physical `pm-context-shifted` event. When switching to a realm that shares a storage tier, the persistence layer doesn't physically pivot, so the event never fires.

We have drafted and approved **ADR-0034: The State Event Trinity**, which establishes the "Headless Core + UI Extender (Adapter)" pattern. Core bundles must exclusively use OSGi `EventAdmin`, while dedicated `-dom` adapter bundles translate these into DOM `CustomEvents` (`pm-context-shifted`, `realm-switched`, `session-changed`) for Alpine UI binding.

## Objectives
- [ ] **Fix Stratographer:** In `org.neverplayed.stratographer/activator.js` (around line 380), extract the `pm-context-shifted` logic into a `syncUI` function and bind it to `pm-context-shifted`, `realm-switched`, and `session-changed` to ensure total UI synchronization.
- [ ] **Implement Realm Manager UI Extender:** Assess `org.neverplayed.realm-manager/activator.js`. It currently dual-broadcasts. Extract the DOM `CustomEvent("realm-switched")` logic into a new adapter bundle (e.g., `org.neverplayed.realm-manager-dom`).
- [ ] **Implement Session Service UI Extender:** Assess `org.neverplayed.session-service/activator.js`. It currently only broadcasts the DOM `CustomEvent("session-changed")`. Modify the core to broadcast the OSGi `SESSION_CHANGED_TOPIC` via EventAdmin. Create a new adapter bundle (e.g., `org.neverplayed.session-service-dom`) to catch the OSGi topic and fire the DOM `session-changed` event.
- [ ] **Verify Headless Integrity:** Ensure the core `session-service` and `realm-manager` no longer contain `globalThis.dispatchEvent` logic.

## Relevant Files
- `docs/adr/0034-the-state-event-trinity.md`
- `public/bundles/org.neverplayed.stratographer/activator.js`
- `public/bundles/org.neverplayed.realm-manager/activator.js`
- `public/bundles/org.neverplayed.session-service/activator.js`
