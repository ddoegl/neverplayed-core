---
from: ana
to: dev
date: 2026-05-17T17:15:40+02:00
subject: Dynamic Surrogate Augmentation Engine
---

# Handover Ticket: Dynamic Surrogate Augmentation Engine

**From:** Cognitive Architect (ana)
**To:** Development Engineer (dev)

## Context
As defined in `surrogate-capability-model.md`, our architecture divides perception into a "Core Matching Engine" and an "Enrichment Layer" (Knowledge Providers). 

Currently, the `shell-cli-ext` (and `stratographer`) hardcodes the injection of `["IdealistVision", "ForensicVision", "ArchitectControl"]` based purely on the active grounding. This is a monolithic violation. As new realms are introduced (e.g., Magic Realm, Cyber Realm), they will introduce specific Marks that require new Senses. We cannot hardcode these realm-specific senses into the global `SessionService` or base surrogate registries.

We need a **Dynamic Augmentation Mechanism** where external bundles (Realms or Context Plugins) can dynamically inject capabilities into the Perceiver context right before a match evaluation occurs, without altering the persisted baseline Surrogate.

## Architectural Design: The Enrichment Protocol

1. **The Knowledge Provider OSGi Pattern:**
   We introduce a new OSGi service interface: `org.neverplayed.plexus.knowledge_provider`.
   Any bundle can register a Knowledge Provider service containing an `enrich(context)` function.
   
2. **Context Augmentation Pipeline:**
   When the `PlexusSensor` or `Evaluator` attempts to match a Mark against the Being's active Surrogate, it first passes the active context through a chain of registered Knowledge Providers.
   
3. **Example Flow (The Magic Realm):**
   - The Magic Realm bundle registers a Knowledge Provider.
   - The user (Surrogate: `person`, Grounding: `realist`) walks into the Magic Realm.
   - A glowing runestone (Mark: `sensing: ["ScentOfMagic"]`) is nearby.
   - Plexus initiates matching.
   - The Magic Realm Knowledge Provider intercepts the context. It sees the user is in the Magic Realm and is a `person` with a `realist` grounding. It dynamically injects `ScentOfMagic` into the temporary sensing array.
   - The Evaluator matches the runestone to the augmented context. The user perceives the runestone.

## Objectives
- [ ] **Define Knowledge Provider Type:** Add `KNOWLEDGE_PROVIDER_SERVICE` to `core-types.js`.
- [ ] **Implement Enrichment Engine:** Update `org.neverplayed.plexus/evaluator.js` (or `plexus-sensor`) to dynamically track all active `KNOWLEDGE_PROVIDER_SERVICE` registrations.
- [ ] **Chain Evaluation:** Before `evaluator.js` checks if a Being can sense a Mark, it must execute the active context through all registered providers.
- [ ] **Refactor Hardcoded Senses:** Create a default Knowledge Provider (e.g., `org.neverplayed.perceiver-service` or a new `org.neverplayed.grounding-provider`) that handles injecting `ForensicVision` and `ArchitectControl` dynamically based on the `realist` grounding, allowing us to remove that hardcoded logic from the CLI and Stratographer entirely!

## Relevant Files
- `public/types/core-types.js`
- `public/bundles/org.neverplayed.plexus/evaluator.js`
- `docs/ideation/surrogate-capability-model.md`
