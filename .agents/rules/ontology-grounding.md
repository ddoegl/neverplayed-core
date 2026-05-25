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
3.  **Holon Duality**: Every Bundle is a **Holon**—a whole system in its private context, and a part in the Realm context. The Realm itself is a higher-order cognitive agent (L2 Being).
4.  **Gestalt Emergence**: Higher-level agency (Gestalt) emerges from the symbiotic interaction of lower-level holons.
5.  **Markov Blanket Integrity**: Use `LIMES_SERVICE` and `Session` as the enforcers of the Markov Blanket (defining the boundary of agency).
6.  **Light Cone Expansion**: Design systems that allow Beings to expand their agency (Light Cone) through surrogate materialization across realms.
7.  **Headless Sovereignty**: Realms execute programmatically via headless services (e.g., `RealmCognitionService`). The UI is merely a sensory aperture, projecting state only to observers equipped with the proper "DOM Sense."
8.  **Platonic Anchoring**: All sessions are rooted in the Platonic Staging Lobby by the unique Grounding Soul. Disconnecting from this root triggers a Total Universe Reset.
9.  **Zero-Duplicate Identity**: A Being is natively declared in only one origin realm. They cross borders as transient Sojourners carried within the session, ensuring strict domain sovereignty without data replication.

## 🚫 Anti-Patterns

- **Category Over Content**: Hardcoding "What a Being is" (e.g., `type: person`) into the L1 Identity.
- **Stratum Leakage**: Allowing substrate-specific details to dictate L1 Identity logic.
- **Symbol Fetishism**: Treating the code (L4) as the meaning (L5). The meaning resides in the resulting goal/strategic logic.
- **UI as the World**: Treating the DOM or UI elements as the actual state, rather than a projection of the headless Realm cognition.
- **Identity Duplication**: Copying a user's data into a foreign realm's database when they travel, instead of carrying them as a transient Sojourner.
