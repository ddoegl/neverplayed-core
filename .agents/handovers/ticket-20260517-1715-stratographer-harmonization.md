---
from: ana
to: dev
date: 2026-05-17T17:15:40+02:00
subject: Stratographer Harmonization & Ontology Alignment
---

# Handover Ticket: Stratographer Harmonization & Ontology Alignment

**From:** Forensic Analyst (ana)
**To:** Development Engineer (dev)

## Context
Two distinct issues exist in the current implementation of the perceptual toggle:
1. **Duplicate Bug:** The Stratographer dashboard UI (`set perspective`) contains the same destructive surrogate replacement bug that was just fixed in the CLI `/level` command.
2. **Terminology Drift:** The system currently maps the CLI's `level` (`beginner`/`advanced`) to the Stratographer's `observerMode` (`idealist`/`realist`). This dual-terminology causes unnecessary translation logic and cognitive overhead.

## Objectives
- [ ] **Harmonize Terminology:** Across the entire codebase, replace the concept of `level` (Beginner/Advanced) with `grounding` (Idealist/Realist). 
    - The CLI command should become `/grounding [idealist|realist]`.
    - Surrogate attributes should use `grounding: "idealist"` instead of `level: "beginner"`.
- [ ] **Refactor Stratographer Toggle:** In `public/bundles/org.neverplayed.stratographer/activator.js`, rewrite the `set perspective()` method to use the correct Surrogate Augmentation logic (preserving the `id` instead of overwriting it).
- [ ] **Centralize Logic:** If possible, abstract the "Surrogate Augmentation" logic into the `SessionService` or `PerceiverService` so both the CLI command and the Stratographer UI call the exact same method to shift groundings.

## Relevant Files
- `public/bundles/org.neverplayed.stratographer/activator.js`
- `public/bundles/org.neverplayed.shell-cli-ext/activator.js`
- `public/bundles/org.neverplayed.perceiver-service/activator.js`
