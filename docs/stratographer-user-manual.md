# The Stratographer & Active Inference: Platform User Manual

## 1. Overview & Conceptual Architecture

The **Never Played OS** is a scale-free, active inference operating system. Rather than viewing the software as a passive collection of database rows and static user interfaces, Never Played models all components—from individual users to application environments and platform infrastructure—as **living cognitive agents (Beings)** maintaining their own boundaries and homeostatic equilibria.

The **Stratographer** (*Areal Forensic Navigator*) is the platform's forensic cockpit. It allows developers, observers, and sovereign agents to:
1. **Navigate** multidimensional coordinate space using sovereign stratum URIs.
2. **Inspect** the active cognitive state, prediction errors, and sensory blankets of realms and beings.
3. **Audit** forensic persistence shards, ConfigAdmin PIDs, and active surrogate configurations.
4. **Transition** seamlessly between abstract platform baselines, inner mind scopes, and external spatial worlds.

---

## 2. Theoretical Foundations: TAME & Active Inference

The system builds directly upon Michael Levin’s **TAME (*Technological Approach to Mind Everywhere*)** and Karl Friston’s **Active Inference**:

```
+-------------------------------------------------------------------------+
|                              TAME SCALE-FREE PLANE                      |
|                                                                         |
|  +--------------------+     Markov Blanket     +---------------------+  |
|  |     L0 TENANT      | <--------------------> |   COSMIC ENVELOPE   |  |
|  +--------------------+                        +---------------------+  |
|            |                                              |             |
|            v                                              v             |
|  +--------------------+     Markov Blanket     +---------------------+  |
|  |     L2 REALM       | <--------------------> |  HOMEOSTATIC WORLD  |  |
|  +--------------------+                        +---------------------+  |
|            |                                              |             |
|            v                                              v             |
|  +--------------------+     Markov Blanket     +---------------------+  |
|  |     L1 BEING       | <--------------------> |   INTERIOR CASTLE   |  |
|  +--------------------+                        +---------------------+  |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Core Tenets

1. **Scale-Free Cognition (Indra’s Net)**:
   * A **Being** is a mind containing nested personas and surrogates.
   * A **Realm** is a larger cognitive being containing nested beings.
   * A **Tenant** is a cosmic envelope containing nested realms.
2. **Markov Blankets**:
   * Every level is bounded by a sensory-active statistical boundary (the *Markov Blanket*).
   * Inside the blanket: internal states, beliefs, and memories.
   * On the blanket: sensory surface marks and active motor effectors.
3. **Surrogates (The Vessels)**:
   * Beings never interact directly with raw hardware or code. They embody **Surrogates**—specialized avatars equipped with defined sensory organs and capabilities.
4. **Free Energy Minimization**:
   * All entities continuously compare incoming sensory data against internal generative priors.
   * **Prediction Error ($F$)** measures the degree of surprise or state desynchronization. Homeostasis is maintained by minimizing $F \to 0.00$.

---

## 3. The Sovereign Stratum Coordinate System

The platform addresses every computational context through a deterministic URI:

$$\mathbf{\text{Stratum URI}} = \texttt{np://}\mathbf{\{tenantId\}}\texttt{/}\mathbf{\{beingId\}}\texttt{/}\mathbf{\{realmId\}}\texttt{/}\mathbf{\{flowId\}}\texttt{?tier=}\mathbf{\{tier\}}$$

### Example
```text
np://8fNNh7UkppadUaKJQhaiMIGzcLd2/8fNNh7UkppadUaKJQhaiMIGzcLd2/tenant:global/shell?tier=local
```

### The Three Navigational Dimensions

| Dimension | Label | Meaning | Examples |
| :--- | :--- | :--- | :--- |
| **WHO** | **Authority / Identity** | The root tenant organization and the currently embodied Being. | `tenantId: 8fNN...`, `beingId: daniel` |
| **WHERE** | **Environment / Scope** | The active realm or cognitive container. | `empty`, `habitat`, `tenant:global`, `being:daniel` |
| **HOW** | **Persistence Tier** | The physical storage engine backing the state. | `local` (IndexedDB/localStorage), `cloud` (Firebase) |

---

## 4. Cockpit Tour: The 4 Forensic Zones

```
+-----------------------------------------------------------------------------------------------+
| [ Universe Dropdown ]  |  np://8fNN.../tenant:global/shell?tier=local  | [IDEALIST] [PRIMORDIAL] |
+------------------------+-----------------------------------------------+----------------------+
| FORENSIC COMPASS       | AREAL TOPOLOGY NAVIGATOR (D3)                 | TRACE RECOVERY       |
|                        |                                               |                      |
| * Active Being:        |       (TENANT)                                | REALM COGNITION:     |
|   8fNNh7Uk...          |          |                                    | * Status: STABLE     |
|                        |          v                                    | * Error: 0.00        |
| * Sensory Spectrum:    |    (PRIMORDIAL) ---> (REALM) ---> (TIER)      | * Surrogate:         |
|   [Primordial]         |                      tenant:global  local     |   sovereign-guard    |
|   [Language]           |                                               |                      |
|                        |                                               | VAULT TRACES:        |
| * Environments:        |                                               | * config.stratographer|
|   [EMPTY] [GLOBAL]     |                                               | * config.sidebar     |
|   [BEING:8fNN]         |                                               |                      |
+-----------------------------------------------------------------------------------------------+
```

### Zone 1: Sovereign Top Bar
* **Address Bar**: Displays the live stratum coordinate. You can edit this text directly and click **`JUMP`** to teleport across realms, beings, or storage tiers.
* **Grounding Switch (`IDEALIST` vs `REALIST`)**:
  * **`IDEALIST`**: Focuses on formal conceptual archetypes, ontological hierarchies, and potentiality.
  * **`REALIST`**: Focuses on empirical runtime artifacts, live occupants, physical DOM marks, and execution logs.
* **Perspective Shunts (`PRIMORDIAL` | `BEING` | `REALM`)**: Shifts the gravitational focus of your observer lens.
* **Attention Counter**: Live telemetry displaying session duration and homeostatic engagement.

### Zone 2: Ontological Compass (Left Panel)
* **Active Being Card**: Shows the hash of the currently embodied identity.
* **Active Sensory Spectrum**: Displays the senses currently active on your surrogate (e.g. `PRIMORDIAL`, `LANGUAGE`, `IDEALISTVISION`).
* **Environment Switcher**: Quick-switch shortcuts between the Platonic baseline (`EMPTY`), tenant envelopes (`TENANT:GLOBAL`), and virtual minds (`BEING:<uid>`).
* **Persistence Tier Selector**: Displays and toggles the active storage tier (`LOCAL` vs `CLOUD`).

### Zone 3: Areal Topology Navigator (Center Canvas)
* An interactive force-directed graph (powered by D3.js) modeling the live connection between:
  * **`TENANT` (Cyan)**: Root security anchor.
  * **`PRIMORDIAL` / `BEING` (Dashed Green/Orange or Purple)**: Active identity node.
  * **`REALM` (Purple)**: Active universe envelope.
  * **`TIER` (Blue/Yellow)**: Physical storage stratum.
* **Interaction**:
  * Click any node to open its **Trace Recovery** in the right panel.
  * Drag nodes to untangle or inspect topological physics.

### Zone 4: Trace Recovery Inspector (Right Panel)
* **Active Observer Sensed Components**: Displays real-time UI components and flows perceived through your active senses via the **Plexus Sensation Engine**.
* **Realm Cognition (TAME)**: Displays the cognitive health, homeostatic status, prediction error, and active surrogate of the selected realm.
* **Forensic Vault Traces**: Live key-value pairs stored in the persistence stratum matching that node’s scope.

---

## 5. Concrete Realms vs. Virtual Realms

Never Played organizes environments into two distinct classes:

```
                                    REALM ECOSYSTEM
                                           |
                +--------------------------+--------------------------+
                |                                                     |
         CONCRETE REALMS                                       VIRTUAL REALMS
  (External Spatial Universes)                          (Introspective Lenses)
  * habitat.json                                        * empty.json (Platonic Lobby)
  * gym.json                                            * tenant:global (Cosmic Envelope)
  * governance.json                                     * being:<uid> (Interior Castle)
  * somatic-body.json                                   * tenant:<uid> (Private Vault)
  (Loads external UI/DOM/canvas bundles)                (Zero-Surge Ingress: bundles: [])
```

### 1. Concrete Spatial Realms
* **Examples**: `habitat`, `gym`, `governance`, `somatic-body`, `gemma`.
* **Nature**: Hosted in consumer repositories (e.g. port `8009`). They contain 3D models, simulation logic, spatial YAML seed data (`beings.yaml`, `surrogates.yaml`), and custom UI bundles.
* **How to Load**: Ingested dynamically via the URL parameter protocol:
  ```text
  http://localhost:8008/?realms=http://localhost:8009/realms/index.json&switch=org.neverplayed.realm.habitat
  ```

### 2. Virtual Realms (Zero-Surge Ingress)
* **Examples**: `empty`, `tenant:global`, `being:<uid>`, `tenant:<uid>`.
* **Nature**: Synthesized dynamically by the platform container. They have `bundles: []`, meaning transitioning into them instantly unloads spatial overhead, providing a pure diagnostic lens into memory, governance, and cognition.

---

## 6. Surrogates Reference Catalog

Surrogates define the sensory blanket and capabilities of an embodied entity:

```
+-------------------+----------------------------------------------------+--------------------------+
| Surrogate ID      | Sensory Spectrum                                   | Domain & Purpose         |
+-------------------+----------------------------------------------------+--------------------------+
| observer          | Primordial, Language, IdealistVision               | Platonic staging, naked  |
|                   |                                                    | diagnostic baseline      |
| sovereign-guard   | Primordial, Language, ForensicVision,             | Tenant boundaries,       |
|                   | ArchitectControl, InhabitantGuardianship           | security enforcement     |
| system-collector  | SpaceReclamation, MemoryAudit, AttentionPruning    | Memory garbage collection|
| person / resident | SpatialVision, TactileInteraction, Locomotion      | Habitat spatial worlds   |
| athlete / avatar  | KinematicFeedback, MuscleStrain, FatigueSense      | Gym & somatic training   |
| delegate / auditor| VoteCasting, ProposalQuorum, LedgerAudit           | Governance & DAO policy  |
| inner-voice       | SemanticEmbedding, TokenSampling, Monologue        | Gemma & LLM sidecars     |
+-------------------+----------------------------------------------------+--------------------------+
```

---

## 7. Light Cone Horizons Reference

The **Cognitive Light Cone** measures the spatial and temporal scale an entity monitors and regulates:

$$\text{Light Cone} = \langle \text{Temporal Predictive Horizon} \rangle \;\Big/\; \langle \text{Spatial Causal Substrate} \rangle$$

| Light Cone Boundary | Temporal Scale | Spatial / Causal Substrate | Context |
| :--- | :--- | :--- | :--- |
| **`Platonic Singularity / Genesis Potential`** | Atemporal ($t = 0$) | Pure potentiality, zero materialized state | `empty` (Platonic Lobby) |
| **`Session (Lazy Horizon) / Spatial Bedrock`** | Interactive Session ($t \sim \text{minutes}$) | OSGi services, ConfigAdmin, storage shards | `tenant:global`, `governance` |
| **`Kinetic Frame (Real-Time) / Somatic Tissue`** | Milliseconds ($t \sim 16\text{ms}$) | Bodily motor units, muscles & kinematics | `gym`, `somatic-body` |
| **`Stigmergic Habitat (Persistent) / Cellular Soil`** | Days to Months ($t \sim \text{persistent traces}$) | Spatial rooms, persistent beings & artifacts | `habitat`, `real-life` |
| **`Introspective Self-Loop / Proprioceptive Memory`** | Inward subjective time | Internal beliefs, prediction error, surrogates | `being:<uid>` (Mind View) |
| **`Multi-Epoch Horizon / Constitutional Ledger`** | Years / Macro-epochs | Ecosystem laws, charters & quotas | Multi-Tenant Organizations |

---

## 8. Forensic Persistence Sharding (ADR-0165)

All persistent state written by bundles and flows is cryptographically sharded:

$$\texttt{Storage Key} = \texttt{np:v1:}\mathbf{\{tenantId\}}\texttt{:}\mathbf{\{identityId\}}\texttt{:}\mathbf{\{realmId\}}\texttt{:}\mathbf{\{key\}}$$

### Inspection Behavior in Stratographer

* **When you click `PRIMORDIAL` / `BEING`**:
  * The inspector displays all records where $\text{identityId} = \text{Selected Being ID}$.
* **When you click `TENANT`**:
  * The inspector displays all records where $\text{tenantId} = \text{Selected Tenant ID}$ (the aggregate across all beings in this tenant).
* **When you click `REALM`**:
  * The inspector displays records where $\text{realmId} = \text{Selected Realm ID}$.
* **When you click `TIER`**:
  * The inspector filters by storage medium (`LOCAL` localStorage/IndexedDB vs `CLOUD` Firebase).

---

## 9. Common Operational Scenarios

### Scenario A: Auditing System Configurations
1. Start `neverplayed-core` on port `8008` (`deno task start`).
2. Open `http://localhost:8008/` in your browser.
3. In the center graph, click the **`PRIMORDIAL`** node.
4. In the right panel, inspect the active ConfigAdmin PIDs:
   * Check `config.org.neverplayed.shell-sidebar` mount points.
   * Check `org.neverplayed.shell.ui.context` session memory.

### Scenario B: Connecting to External Consumer Realms
1. Start the core platform on `http://localhost:8008`.
2. Start the consumer realm server on `http://localhost:8009` (`neverplayed`).
3. In the browser, navigate to:
   ```text
   http://localhost:8008/?realms=http://localhost:8009/realms/index.json&switch=org.neverplayed.realm.habitat
   ```
4. The Core platform will discover all actionable realms (`foundation`, `habitat`, `governance`, `somatic-body`, `gym`, `gemma`), normalize their remote bundle URLs, seed their native beings, and auto-land in **Habitat**.

### Scenario C: Introspecting a Being's Inner Mind
1. In the left panel under **ENVIRONMENT**, click your **`BEING:<uid>`** button.
2. The platform performs **Zero-Surge Ingress**, switching the coordinate to `np://<tenant>/<uid>/being:<uid>/shell`.
3. Click the **`REALM`** node to view the Being's active prediction error, homeostatic stability, and equipped surrogates.

---

## 10. Summary & Cheat Sheet

* **Stratum Address**: `np://<tenant>/<being>/<realm>/<flow>?tier=<tier>`.
* **Grounding**: `IDEALIST` (Archetypes) vs `REALIST` (Empirical Traces).
* **Clicking Nodes**: 
  * `TENANT` = Tenant-wide vault.
  * `PRIMORDIAL` = Invariant identity settings.
  * `REALM` = Cognitive homeostasis ($F$), active surrogate, and light cone.
  * `TIER` = Storage engine traces.
* **Scale-Free Principle**: *A Being is a Realm from the inside, and a Realm is a Being from the outside.*
