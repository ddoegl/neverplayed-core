# Cognitive Architect - Session State
_Last updated: 2026-08-23 — Workspace: `neverplayed-core` / `neverplayed`_

## Current Goal
- Guard and evolve the core active inference system architecture, platform priors, and ADRs.
- Ensure strict ontological separation between invariant substrate (`neverplayed-core`) and volatile generative models (`neverplayed-realms`).

## Completed Items
- Ingested meta-rules from `.agents/rules/agent-cognitive-architect.md`.
- Mapped system ontology: Sovereign Beings, Realm Ontology, Limes/Plexus, Governance/Persistence Architecture.
- Validated Scale-Free Cognition (Holons and Cognitive Light Cones) and Active Inference applied to Realms.
- Validated Primordial Bootstrapping, Platonic Staging Lobby, and Double-Loop of Exteroception.
- Validated Headless Decoupled Stratum mapping (UI as Sensory Apertures) and Zero-Duplicate Identity.
- Validated Section 11: Scale-Free Homeostasis, Temporal Attention, Stigmergic Coupling, and Sensation Floor.
- Validated Scale-Free Symmetry of Logout and L2 Inhabitation ("Dreaming to be a Realm").
- Validated `gemma-llm-inner-voice-proposal.md`: Narrative Self behind L1 Markov blanket with World Model Compaction.
- Authored & Accepted `ADR-0035: Multi-Workspace Infrastructure and Realm Decoupling`.
- Validated completion of `TICKET-20260823-1545-CORE-INFRASTRUCTURE-EXTRACTION`:
  - `neverplayed-core` isolated as standalone OSGi container on port `8008` (16/16 tests passing).
  - Universal `index.html` container harness supporting `?realm=http://localhost:8009/...` dynamic injection.
  - Clone-and-Prune Git migration preserving 100% history.

## Pending Items
- Support future ADRs and conceptual design for realm Umwelten and platform sensor evolutions.

## Key Decisions & Context
- **ADR-0035 Invariance Boundary**: Substrate priors live in `neverplayed-core`; volatile generative realms live in `neverplayed`.
- **Platform Sovereign Container**: `neverplayed-core/public/index.html` knows only the Platonic Lobby. All domain worlds are dynamically admitted at runtime.
- **Dual-Server Local DX**: Core on `:8008`, Realms on `:8009`.
