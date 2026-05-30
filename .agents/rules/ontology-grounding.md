# Rule: Ontological Grounding & Information Hierarchy

This rule ensures that all system development adheres to the **Matter to Meaning** information hierarchy and the concepts of **Gestalt Beings**, **Holons**, and **Headless Sovereignty**.

## 🧬 The Information Hierarchy (L0–L6)

All architectural decisions must be mapped to the appropriate level of the hierarchy:

- **L0: Realm (The Meta-Layer)**: Fundamental physics and global logic (e.g., Code vs. Biology).
- **L1: Identity (The Semantic Core)**: Substrate-independent essence/organization (The "Soul").
- **L2: Stratum (The Structural Layer)**: The "floor" where a process resides (e.g., OSGi Registry).
- **L3: Substrate (The Foundational Layer)**: The physical medium (Silicon, RAM).
- **L4: Symbols (The Vehicle)**: The code/tokens carrying info (Events, PIDs).
- **L5: Semantics (The Meaning)**: The goal or strategic logic conveyed by symbols.
- **L6: Surrogate (The Functional Proxy)**: The interface through which an identity acts (Activator, Service).

## 🛡️ Core Principles

1.  **Substrate Independence**: Always design logic that can persist across different media (Strata/Substrates).
2.  **Agnostic Identity**: A Being (L1) has no inherent "Nature" (e.g., "Person"). It only has **Intent** and **Classification-by-Inhabitation**.
3.  **Holon Duality & Symbiosis**: Every Bundle is a **Holon**—a whole system in its private context, and a part in the Realm context. The Realm (L2 Being) and nested L1 Beings exist in somatic symbiosis; changes in the Realm's body propagate as sensory stimulus to the L1 Beings.
4.  **Gestalt Emergence**: Higher-level agency (Gestalt) emerges from the symbiotic interaction of lower-level holons.
5.  **Markov Blanket Integrity**: Use `LIMES_SERVICE` and `Session` as the enforcers of the Markov Blanket. Beings never perceive the Realm directly; they perceive stigmergic marks on its surface.
6.  **Light Cone Expansion**: Design systems that allow Beings to expand their agency (Light Cone) through surrogate materialization across realms. Surrogates (clothing) should carry over across boundaries if the new realm permits.
7.  **Headless Sovereignty**: Realms execute programmatically via headless services. The UI is merely a sensory aperture, projecting state only to observers equipped with the proper "DOM Sense."
8.  **Platonic Anchoring**: All sessions are rooted in the Platonic Staging Lobby by the unique Grounding Soul. Disconnecting triggers a Total Universe Reset.
9.  **Zero-Duplicate Identity**: A Being is natively declared in only one origin realm. They cross borders as transient Sojourners carried within the session, ensuring strict domain sovereignty.
10. **Temporal Attention Homeostasis**: Beings require continuous sensory stimulus. Attention exhaustion (boredom) causes active retreat (falling asleep) to the Platonic Lobby.
11. **Primordial Sensation Floor**: Naked Beings always retain a baseline `"Primordial"` sense, preventing absolute topological isolation and ensuring core platform organs remain visible.
12. **Scale-Free Symmetry of Logout**: Logouts cascade hierarchically. L1 exit strips the surrogate; L2 shutdown dissolves the environment (ejecting occupants); L0 exit causes total universe reset.
13. **L2 Inhabitation (Dreaming as a Realm)**: Diagnostic and admin tools must be conceptually mapped as the Grounding Soul shifting its cognitive focus to inhabit the L2 Realm Being directly, adopting its interoceptive somatic viewport (heaps, surges, configs).
14. **Singular Spatial Occupancy (No Bilocation)**: A Being has exactly one native physical presence logged in a given spatial realm (the un-prefixed `<id>`). Coordinate modifiers (`being:` and `realm:`) function as perspectival shunts (viewports) that alter the cognitive lens without registering duplicate ghost occupants in the physical topology.

## 🚫 Anti-Patterns

- **Category Over Content**: Hardcoding "What a Being is" (e.g., `type: person`) into the L1 Identity.
- **Stratum Leakage**: Allowing substrate-specific details to dictate L1 Identity logic.
- **Symbol Fetishism**: Treating the code (L4) as the meaning (L5). The meaning resides in the resulting goal/strategic logic.
- **UI as the World**: Treating the DOM or UI elements as the actual state, rather than a projection of the headless Realm cognition.
- **Identity Duplication**: Copying a user's data into a foreign realm's database when they travel.
- **Passive Logging Out**: Ejecting a user via a dumb timer rather than treating it as active cognitive retreat (attention exhaustion).
- **Admin God-Mode as Magic**: Treating admin dashboards as magic "out-of-world" UIs rather than an explicit L2 Inhabitation surrogate with its own defined sensory viewport.
