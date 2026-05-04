# Rule: Ontological Grounding & Information Hierarchy

This rule ensures that all system development adheres to the **Matter to Meaning** information hierarchy and the concepts of **Gestalt Beings** and **Holons**.

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
3.  **Holon Duality**: Every Bundle is a **Holon**—a whole system in its private context, and a part in the Realm context.
4.  **Gestalt Emergence**: Higher-level agency (Gestalt) emerges from the symbiotic interaction of lower-level holons.
5.  **Markov Blanket Integrity**: Use `LIMES_SERVICE` and `Session` as the enforcers of the Markov Blanket (defining the boundary of agency).
6.  **Light Cone Expansion**: Design systems that allow Beings to expand their agency (Light Cone) through surrogate materialization across realms.

## 🚫 Anti-Patterns

- **Category Over Content**: Hardcoding "What a Being is" (e.g., `type: person`) into the L1 Identity.
- **Stratum Leakage**: Allowing substrate-specific details to dictate L1 Identity logic.
- **Symbol Fetishism**: Treating the code (L4) as the meaning (L5). The meaning resides in the resulting goal/strategic logic.
