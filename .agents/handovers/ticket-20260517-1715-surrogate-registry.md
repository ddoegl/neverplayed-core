---
from: ana
to: dev
date: 2026-05-17T17:15:40+02:00
subject: The Surrogate Registry
---

# Handover Ticket: The Surrogate Registry

**From:** Forensic Analyst (ana)
**To:** Development Engineer (dev)

## Context
Currently, the OSGi ecosystem lacks a central registry defining the base physical attributes of surrogates. When `beings.yaml` maps Rob to the `person` surrogate, the system treats `person` as a blank string. Base senses are being artificially injected as empty arrays (`[]`) within the CLI code.

To establish true architectural grounding, we must explicitly define the hardware capabilities (base senses) of every surrogate in the system.

## Objectives
- [ ] **Create `surrogates.yaml`:** Create a new data definition file at `public/bundles/org.neverplayed.being-service/data/surrogates.yaml`.
- [ ] **Define Base Surrogates:** Define at least the `person` and `guest` surrogates, explicitly stating their intrinsic base senses (e.g., `["ToolUse", "Language"]` for `person`).
- [ ] **Hydrate Registry:** Update `org.neverplayed.being-service/activator.js` to load `surrogates.yaml` during boot via the YAML Service.
- [ ] **Initialize Beings correctly:** When `BeingService` registers identities into `SessionService` (or when `session.login` is called for the first time), the system should look up the initial surrogate ID in the Surrogate Registry and populate the being's base senses accordingly.

## Relevant Files
- `public/bundles/org.neverplayed.being-service/data/surrogates.yaml` (NEW)
- `public/bundles/org.neverplayed.being-service/activator.js`
- `public/bundles/org.neverplayed.session-service/activator.js`
