This document describes the information hierarchy, which integrates **Realms**
as the governing meta-layer and **Identity** as the persistent semantic core.
This structure is designed to serve as an ontological foundation for a
**Pandino-OSGi** implementation.

A future vision is that self-evidencing agents (bundles) interact within defined
logical boundaries.

### Level 0: Realm (The Meta-Layer)

The **Realm** is the highest level of categorization, acting as the
"Meta-Stratum" that dictates the fundamental rules—the **"physics" or global
logic**—of the environment.

- **Function:** It defines the scope, governance, and limits of supervenience
  for all processes within it.
- **Pandino Implementation:** The **Ultimate Realm** is the Pandino framework
  itself, while **Sub-Realms** can be implemented as independent ecosystems with
  their own "local physics" (e.g., a "Security Realm" with strict entropy rules
  vs. a "Creative Realm" with fluid logic).

### Level 1: Identity (The Semantic Core)

**Identity** represents the **Semantics** level of the hierarchy—the unique
pattern of goals, logic, and memories that defines an entity.

- **Function:** It is the **substrate-independent "essence"** or generative
  model used to maintain homeostasis. Identities can be **nested** (a master
  bundle managing sub-agents) or **connected** (a single core spanning multiple
  surrogates).
- **Pandino Implementation:** This is either the human identity or an ai-agents
  identity, represented by the **Genkit Generative Model** (the prompt and
  internal belief state) that persists even if the underlying bundle is stopped
  or moved.

### Level 2: Stratum (The Structural Layer)

The **Stratum** is the specific "floor" or level of reality where a process
lives.

- **Function:** It provides the structural environment for interactions and
  sensory perturbations. Each stratum depends on the layer below it through
  **supervenience**.
- **Pandino Implementation:** The **Pandino Runtime and OSGi Framework** serve
  as the primary stratum, providing the service registry and bundle lifecycle.

### Level 3: Substrate (The Foundational Layer)

The **Substrate** is the actual physical material that supports all
computational processes.

- **Function:** It provides the "stuff" (energy and matter) required for the
  system to function.
- **Pandino Implementation:** The **silicon chips, CPU, and RAM** of the host
  machine.

### Level 4: Surrogate (The Functional Interface)

A **Surrogate** is the physical or digital proxy through which an **Identity
materializes** in a specific stratum.

- **Function:** It acts as the interface used to exert influence or collect
  data; the Identity uses the surrogate to "log in" to a Realm or Stratum.
- **Pandino Implementation:** The **Bundle Activator and Service Interface**.
  The identity (Genkit logic) uses the bundle as its functional body to act upon
  the OSGi registry.

### Level 5: Symbols (The Communication Vehicle)

**Symbols** are the specific tokens, characters, or code used to carry
information across the system’s **Markov Blanket**.

- **Function:** They are the tools used to encode the Identity's semantics for
  transmission through the environment.
- **Pandino Implementation:** **OSGi Events** (via EventAdmin) and **ConfigAdmin
  PIDs**, which act as the "nervous system" of the framework.

### Level 6: Traces and Scaffolds (The Stigmergic Layer)

This level represents the **emergent state** of the environment created by the
interactions of multiple identities.

- **Function:** Identities leave **Symbolic Traces** (messages, state changes)
  in a **Shared Stratum**, creating a **Scaffold** that guides future actions.
- **Pandino Implementation:** The evolving state of the **Service Registry** and
  shared **Data Vaults** (key/value stores). This represents the "narrative
  legacy" of the ecosystem.

### Ontological Summary for Development

| Level | Component     | Pandino-OSGi Construct         | Relationship                                   |
| :---- | :------------ | :----------------------------- | :--------------------------------------------- |
| **0** | **Realm**     | Framework Instance / Sub-World | Governs the meta-rules and boundaries.         |
| **1** | **Identity**  | Genkit Generative Model        | The substrate-independent "agent" core.        |
| **2** | **Stratum**   | OSGi Service Registry          | The structural "floor" for sensing and acting. |
| **3** | **Substrate** | Physical Hardware (Silicon)    | The foundational physical support.             |
| **4** | **Surrogate** | Bundle Activator / Service     | The functional proxy for the Identity.         |
| **5** | **Symbols**   | EventAdmin / ConfigAdmin       | The vehicles for symbolic communication.       |
| **6** | **Traces**    | Shared Vaults / Registry State | The stigmergic results of agent actions.       |

# Supervenience and Substrate-Independence

**Supervenience** refers to the **layered dependency** inherent in the
information hierarchy, where a higher-level stratum depends entirely on the
layer directly below it. In a computing environment, for example, the software
stratum depends on the operating system, which in turn **supervenes on the
physical hardware substrate**. Within this framework, the **Realm** serves as
the meta-layer that dictates the **scope, governance, and limits of
supervenience** for all processes and strata contained within it.

This relationship implies a structural "floor" or dependency where the physical
**Substrate** provides the foundational "stuff" (matter and energy) required for
higher-level functions to exist and operate. **Nested identities** specifically
follow the logic of supervenience; for instance, a master bundle identity might
manage multiple specialist agent identities, with each level "living" within the
environment and rules provided by the layer below it.

It is important to distinguish supervenience from **substrate-independence**,
which is the capability that allows a "pattern"—such as a specific **Identity**
or **Semantics**—to **migrate or "jump" between different strata** or platforms
regardless of the underlying physical material. While supervenience binds a
specific _instance_ of a process to its supporting layers, the **semantic core**
of an identity remains portable and can be materialized through different
**Surrogates** across various strata or even across different realms.
