# Ideation: Surrogate Capability Model (Master)

## 1. Executive Summary
This document serves as the **Master Blueprint** for the Never Played perception framework. It unifies the concepts of institutional access control (**Limes**) and stigmergic sensing (**Plexus**) into a single, ontologically grounded **Capability Model**.

## 2. The Ontological Layers

### Layer 1: Limes (The Markov Blanket)
**Limes** acts as the **Markov Blanket**—the primary boundary that separates the Being's internal state from the external environment.
- **Function**: Hard Architectural Gate (Legality).
- **Metaphor**: The "Skin" or the "Locked Door".
- **Rule**: Deterministic (Allowed/Denied). If the blanket is opaque (access denied), the Being is **blind** to the entire universe inside. No sensing can occur because the Being cannot "penetrate" the realm.
- **Analogy**: If you can't get into the room, you can't smell anything inside.

### Layer 2: Plexus (The Sensory Apparatus)
**Plexus** acts as the **Sensing Engine**. It determines what is "sensible" once the Markov Blanket is breached.
- **Function**: Perceptual Filtering (Sensing).
- **Metaphor**: The "Nervous System" or the "Sense of Smell".
- **Rule**: Probabilistic/Dynamic (Sensed/Occluded). It matches a Being's **Senses** (Capabilities) against the environment's **Marks** (Traces).

## 3. The "Smell" Metaphor
To understand how Plexus operates in orchestration with the environment, we use the metaphor of **Olfactory Perception**:

1. **The Mark (The Smell)**: Elements in the environment (Bundles, Domain Objects, Stratum Nodes) expose a "Mark" (e.g., `data-sensing` or `sensing` metadata). This mark is the "smell" emitted by the object.
2. **The Sensor (The Nose)**: The **Plexus Sensor** probes the environment and "detects" these smells.
3. **The Capability (The Sense)**: The **Surrogate** defines which "smells" the Being is capable of perceiving. If the Surrogate has the "Sense" for a given "Mark," the perception is materialized.

## 4. The Perceptual Workflow (Emit -> Perceive)

1. **Emit**: An object in the environment exposes a sensible mark (Smell).
   - *Example*: A Governance Bundle exposes `sensing: { matchers: [{ type: "matchRole", role: "GOVERNOR" }] }`.
2. **Sense**: The Plexus Sensor detects this mark on the object.
3. **Infer**: The Plexus Engine checks if the current **Surrogate** has the required capability (e.g., the `GOVERNOR` role).
4. **Perceive**: 
   - **Match**: The object "materializes" in the Being's UI (Sensed).
   - **Mismatch**: The object remains "invisible" or faded (Occluded).
5. **Recover (The Stratographer)**: The **External Observer** (the human/tenant representative) uses the **Stratographer** (Stratum Explorer) to inspect the Being's perception.
   - **Idealist Mode**: Viewing the universe *as if being the Being* (observing only what is Sensed).
   - **Realist Mode**: Viewing the *total universe* (observing all Marks and Traces regardless of Surrogate capabilities).

## 5. Forensic Instruments (Terminology)

To maintain ontological clarity, we distinguish between the following forensic instruments:

- **The Stratographer (Stratum Explorer)**: The primary forensic observation tool (`org.neverplayed.stratum-explorer`). This is where the External Observer performs deep inspection of Marks, Traces, and the Stigmergic Field.
- **The Stratum HUD (formerly Stratographer)**: The lightweight, "always-on" status instrument (`org.neverplayed.stratum-hud`). It provides real-time telemetry of the Being's current sensory state without the depth of the full Explorer.

## 6. The Unified Matching Architecture

To resolve the current logic drift and eliminate legacy domain-specific code, we are moving toward a tiered architectural split:

### Layer A: The Matching Engine (The Core)
- **Role**: A stateless, mathematical utility.
- **Responsibility**: Takes a **Context** (a flat object of attributes) and a set of **Matchers** (the requirements), and returns a **Boolean** or a **Scope Grant**.
- **Purity**: This core has **no knowledge** of "Beings," "Roles," or "Licenseholders." It only knows how to compare keys to values.
- **Analogy**: The "Logic Gate" or the "Nerve Cell."

### Layer B: The Markov Blanket (Limes)
- **Role**: Strategy Manager & Gatekeeper.
- **Responsibility**: Defines the **Frontier Strategies**. It uses the Core Engine to determine if a specific Being context is "Allowed" into a realm or flow.
- **Focus**: Legality and Institutional Boundaries.
- **Orchestration**: It does not implement matching logic; it delegates to the Core Engine.

### Layer C: The Sensing Mechanism (Plexus)
- **Role**: Perceptual Intelligence.
- **Responsibility**: Maps environmental **Marks** to the Being's UI materialization. It uses the Core Engine to evaluate if a **Mark** is "Sensed" by the current Surrogate.
- **Focus**: Attention and Visibility.
- **The Sensing Organ (Plexus-Sensor)**: The component that "probes" the environment (DOM, Service Registry, or **Persistence Vaults**) for **Marks** and feeds them into the evaluation loop.

### Layer D: The Enrichment Layer (Knowledge Providers)
- **Role**: Context Preparation.
- **Responsibility**: This is where **Legacy Domain Logic** (e.g., mapping `LEGALREP` or checking specific License-holder IDs) is migrated. 
- **Function**: It intercepts the raw Being identity and "enriches" the Context with computed attributes *before* evaluation occurs.
- **Benefit**: The Matching Engine stays pure, while the complexity of business rules is isolated in specific, domain-aware providers.

## 7. Persistence Sensing (Vault Marks)

In addition to ephemeral UI elements, **Data Traces** stored in the system's Vaults (Local Storage or Cloud) carry their own **Marks**. 

- **The Concept**: A trace in a vault is not just "data"; it is a sensible artifact. 
- **Vault Filtering**: Different Surrogates may perceive different traces within the same vault or across different vaults.
- **Mark Patterns**: Sensing in the persistence layer often targets structural metadata:
    - **PID Prefix Sensing**: A Surrogate might only "sense" traces whose Process IDs start with a specific prefix (e.g., `org.neverplayed.plexus.*`).
    - **Vault Affinity**: Some Surrogates may be blind to the "Cloud" vault while having sharp vision in the "Local" vault.
- **Implementation**: The **Persistence Manager** acts as a secondary "Sensing Organ," providing a filtered view of the keys/values based on the Surrogate's sensory capabilities.

## 8. The Unified "Mark" Workflow (Refined)

1. **Emission (Environment/Vault)**: An object (Button, Service, or Persistence Key) carries or is associated with a **Mark**.
2. **Probing (Plexus-Sensor)**: The Sensing Organ probes the environment (DOM) or the persistence layer (Vaults) and identifies the **Mark**.
3. **Enrichment (Knowledge Providers)**: The system takes the current Being's raw Identity and calculates their active roles, authorities, and senses, creating a **Rich Context**.
4. **Evaluation (Matching Engine)**: The Engine compares the **Rich Context** against the **Mark**.
5. **Materialization (Plexus)**: Based on the result, the object/trace is "materialized" (Visible/Sensed) or remains "invisible" (Occluded/Occluded).

## 9. From "Levels" to "Capabilities" (The Perspective Shift)

The transition from a linear difficulty slider to a multidimensional Capability Model is grounded in the shift between two fundamental perspectives:

### Beginner Mode: The Idealist Perspective
- **The Perceiver**: The Being acting *within* the universe.
- **Sensing Filter**: Heavily restricted. Perception is limited to "Materialized" objects that are relevant to the Being's immediate survival or task.
- **Reality Constraints**: External "Architectural" elements (e.g., Universe Settings, Data Reset, Forensic Traces) are **occluded**. For an Idealist Surrogate, these elements simply do not exist in their sensible world.
- **Analogy**: The character inside the game who doesn't know they are in a simulation.

### Advanced Mode: The Realist Perspective
- **The Perceiver**: The External Observer or "Architect" probing the universe.
- **Sensing Filter**: Fully transparent. The Realist Surrogate can pierce the Markov Blanket and the Sensory Filter to see all **Marks** and **Traces**.
- **Reality Control**: Access to the "Forensic Vault" and "Universe Settings" is materialized. This Surrogate sees the universe as a whole and can impact its underlying state.
- **Analogy**: The developer with the console open, seeing the source code and the game world simultaneously.

## 10. Terminology Alignment: HUD vs. Stratographer

- **Idealist HUD**: The "Always-On" instrument for the Beginner. It shows only the "Vital Signs" and "Local Senses."
- **Realist Stratographer**: The full explorer for the Advanced user. It provides the "Total View" and "Forensic Insight."

## 11. Subjective Reality vs. Analytical Vantage Point

To harmonize the `/level` command with the Stratum Explorer's toggle, we distinguish between the **Subjective Reality** of the participant and the **Analytical Vantage Point** of the observer:

### The Being's Subjective Reality (`/level`)
- **Defined By**: The Surrogate's Capability Inventory.
- **Impact**: Determines what is "sensed" or "materialized" in the Being's lived experience (Shell, Header, Realm).
- **Scope**: Internal to the Being. If the Being is a "Beginner," they literally cannot sense the Universe Settings mark.

### The Observer's Analytical Vantage Point (Explorer Toggle)
- **Defined By**: The forensic mode of the Stratographer.
- **Impact**: Determines how the External Observer views the Being's world.
    - **Idealist View**: Filters the world through the Being's active capabilities. The Observer sees exactly what the Being sees.
    - **Realist View**: Bypasses all sensory filters. The Observer sees the "Truth" (all Marks and Traces), even those occluded from the Being's current subjective reality.
- **Harmonization**: When the `/level` changes, the **Subjective Reality** shifts. If the Observer is in **Idealist View**, their vision shifts in sync with the Being. If the Observer is in **Realist View**, they see the shift occur "under the hood" but their own vision remains unrestricted.

## 12. Deprecation Note
This document supersedes and deprecates the following drifting ideation files:
- `docs/ideation/stigmergic-sensing-plexus.md`
- `docs/ideation/sensing-capabilities.md`

---
*Draft v2.5.0 - 2026-05-12 - Modes mapped to Idealist/Realist Perspectives*
