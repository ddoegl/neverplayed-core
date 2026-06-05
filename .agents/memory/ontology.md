# Project Ontology: Beings, Inhabitation & Perception

> [!NOTE]
> **Document Role: Foundational Specification**  
> This document serves as the formal, structural, and technical baseline taxonomy for the *Never Played* ecosystem. It defines the core mathematical relationships, active inference engines, TAME homeostasis loops, and their direct mappings to the TypeScript/JavaScript implementation. It functions as the strict reference ground-truth for development and verification. For phenomenological and philosophical reflections on meaning in this space, see [ontological-investigation.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontological-investigation.md).

This document formalizes the ecological, sovereign, and worldbuilding ontology of the *Never Played* ecosystem. It defines the spiritual and physical concepts of beings, their spatial residency, and how their perception is mediated through form.

---

## 1. Core Entities: The Spectrum of Existence

Existence in the ecosystem is categorized by a being's origin, their current presence, and their transient status.

```mermaid
graph TD
    subgraph Space ["The Ecosystem (Realms)"]
        subgraph RealmA ["Realm of Origin (Home)"]
            B1["Being"] -->|Anchored| R["Resident / Denizen"]
            R -->|Present| O["Occupant"]
            O -->|Active| I["Inhabitant"]
        end
        
        subgraph RealmB ["Visited Realm (Foreign)"]
            B1 -->|Visiting| V["Sojourner / Transient"]
            V -->|Present| O
        end
        
        T["Stigmergic Traces (Scents/Marks)"] -->|Forensic| I
    end
    
    B1 -->|Assumes| S["Surrogate (Form of Being)"]
    S -->|Leaves| T
```

### The Being (L1)
*   **Definition:** The primary, sovereign entity (the "soul", identity, or credentials). 
*   **Properties:** Unique global ID, email anchor, and a bag of possessed surrogates.
*   **Lifetime:** Permanent across all realms and session resets.

### Resident / Denizen / Native (Roots)
*   **Definition:** A being with a formal, anchored "home base" or permanent attachment to a specific realm (their jurisdiction or realm of origin).
*   **Relationship:** Every being has exactly one native origin realm where they are born/anchored (`originRealmId`).
*   **Lifetime:** Permanent association.

### Sojourner / Transient / Visitor
*   **Definition:** A being who is temporarily present in a realm other than their origin.
*   **Relationship:** They are a traveler passing through, occupying space without native roots.
*   **Lifetime:** Volatile (ends when the being departs the realm).

### Occupant
*   **Definition:** Any being currently active and session-logged into a given realm (either as a present resident or as a visitor).
*   **Relationship:**
    $$\text{Occupants} = \text{Present Residents} \cup \text{Present Visitors}$$
*   **Lifetime:** Volatile (bound to the active session state).

### Trace-Maker (Forensic/Historical Presence)
*   **Definition:** A being who is not currently logged into the realm but has left behind persistent digital or physical footprints in the realm's persistence stratum.
*   **Relationship:** They represent the forensic signature of a past actor. Under the Realist perspective, they are visualized as amber "ghosts" in the topology.
*   **Lifetime:** Persistent (remains as long as their traces exist in the database, even if the being is offline).

### Inhabitant
*   **Definition:** Any being with any form of presence (either active session-bound or forensic trace-bound) in a given realm.
*   **Relationship:** The union of active occupants and forensic trace-makers:
    $$\text{Inhabitants} = \text{occupants} \cup \text{traceMakers}$$
*   **Lifetime:** Dynamic (extends from active session occupancy to historical persistence footprints).


---

## 2. Forms of Being: Surrogates & Reification

Beings cannot interact with realms directly in their raw L1 state. They must manifest through physical or functional forms.

### Surrogates (L6)
*   **Definition:** A specific "form of being" or persona assumed by a being.
*   **Reification:** Realms are sovereign jurisdictions; they only reify (make real) particular surrogates. For example, the *Governance* realm may only reify the `person` surrogate, whereas the *Habitat* realm may reify `agent` or `being`.
*   **Equipping:** A being "wears" a surrogate to interact with a realm's structural objects.

### Stigmergic Traces (Scents & Marks)
*   **Definition:** The physical or digital footprints left behind by a surrogate in the soil of a realm.
*   **Sensing:** Surrogates leave sensible marks (`data-mark` configurations, database entries, files) that can only be perceived by other surrogates equipped with matching senses.

---

## 3. Perception & Perspectives

Perception is not absolute; it is mediated by the observer's grounding, perspective, and their scale of inhabitation.

### The Idealist Perspective (L1 Viewport)
*   **Concept:** Subjective experience. The world as experienced by an individual L1 Occupant.
*   **Visibility:** Co-residency and co-inhabitation are hidden by the Markov Blanket. An L1 surrogate cannot directly see other beings or the Realm's internal structure; they can only sense the **stigmergic traces** (scents/marks) left behind on the surface of the environment, provided their surrogate possesses the matching senses.

### The Realist Perspective (L2 Inhabitation / Dreaming as a Realm)
*   **Concept:** Objective structure. The world as experienced by the environment itself (the L2 Realm Being).
*   **Visibility:** The Realist perspective is not an L1 visual filter; it is the act of the Grounding Soul shifting its cognitive focus upwards to perform **L2 Inhabitation**. The observer looks through the Realm's somatic viewport (interoception), fully visualizing the topological graph of inhabitants (Natives and Sojourners) and systemic health (CPU, PIDs, surges) as cellular nodes flowing through its body.
*   **The Unattended Holon (Coasting Husk):** When the Grounding Soul shifts into this L2 perspective, its original L1 surrogate is left behind in the spatial environment. It does not instantly dissolve. Instead, it becomes an unattended holon "coasting" on its remaining attention span. From the new L2 Realist viewport, the observer perceives their own unattended L1 surrogate exactly as they perceive all other active occupants—as a living node that will eventually fall asleep when its own homeostatic boredom threshold is reached.

### The Triad of Presence
1.  **Sovereign Awareness (`being:<id>`):** The Mind/Soul focus. The observer sits at the **hub** of the Wheel of Awareness, looking down the spoke of attention as a silent meta-cognitive observer.
2.  **Somatic Experience (`realm:<id>`):** The Body/Markov Blanket focus. The observer sits on the **rim** of the Wheel of Awareness, physically embedded in the spatial environment, experiencing direct exteroceptive contact and cellular sensations.
3.  **Primordial Ground State (`<id>` raw):** The Naked Actor. Rob as a totipotent cell. An un-prefixed database entry carrying uncollapsed morphic potential, representing the baseline integration of both.

### The Principle of Singular Spatial Occupancy (Path B)
To prevent **Ontological Bilocation Violations** (where a single being registers concurrent disassociated occupant sessions in the same space):
*   **Singular Visitor Node:** A Being has exactly **one native physical presence** logged in a given spatial realm (the un-prefixed `<id>`, e.g., `rob`).
*   **Viewport Shunts:** The coordinate modifiers `being:` and `realm:` do not register as separate spatial occupants. Instead, they function as perspectival shunts (navigable viewports) that refractionally alter the observer's cognitive lens without split-billing their physical presence.

### The 4 States of Consciousness Matrix
By crossing the independent axes of **Grounding** (Direction of the vector) and **Viewport** (active lens), the system formalizes four integrated states of awareness and experience:

| Grounding (Vector) | Viewport (Lens) | Ontological Mapped State |
| :--- | :--- | :--- |
| **Idealist** (Subject $\rightarrow$ Object) | `being:<id>` | **Pure Idealist Awareness:** Subjective mind observing a spatial room. |
| **Idealist** (Subject $\rightarrow$ Object) | `realm:<id>` | **Somatic Inhabitation:** Subjective body experiencing spatial contact. |
| **Realist** (Object $\rightarrow$ Subject) | `being:<id>` | **Mind-Objectification:** Objective mind observed as a spatial room. |
| **Realist** (Object $\rightarrow$ Subject) | `realm:<id>` | **Body-Objectification:** Objective body observed as a spatial room. |

### The Sensory Apparatus of Beings (L1 Senses)
Just as L2 Realms possess interoceptive and exteroceptive senses, L1 Beings experience their environments through surrogate-mediated sensory modalities:
1.  **`Primordial` (Visceral Baseline Sensation):**
    *   *Definition:* The baseline platform-level awareness. Ensures that even a naked observer is never completely blind and can perceive the platform's visceral components (Stratographer, CLI, header widgets).
2.  **`Language` (Linguistic Sensation):**
    *   *Definition:* The capability to identify and decode textual data-marks, written logs, and verbal messages left on the soil. Also allows the Being to write/utter language traces.
3.  **`ForensicVision` (Historical Footprint Sensation):**
    *   *Definition:* The capability to perceive historical trace-makers and chronological footprints (amber ghosts) left in the database stratum.
4.  **`SelfAwareness` (Proprioceptive Self-Sensation):**
    *   *Definition:* The capability of the Being's inner voice to identify exteroceptive sensations and traces referencing its own ID, translating them into direct first-person proprioceptive statements.
    *   *Ontological Impact:* Resolves self-objectification by shifting third-person observations (*"Occupant Node 'rob' is present"*) into unified, subjective first-person proprioception (*"I am present in this space"*).

---

## 4. Architectural Mapping (Code vs. Ideal)

To maintain code integrity, the translation between this ontological ideal and the actual TypeScript/JavaScript implementation is mapped as follows:

| Ontological Concept | Technical Implementation | File Reference |
|---|---|---|
| **Being (L1)** | `session.activeBeingId` / `session.currentUser.id` | [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) |
| **Native Resident** | `currentUser.originRealmId` / `being.originRealmId` | [being-service/data/beings.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/beings.yaml) |
| **Volatile Occupant** | `stratum.occupants` (or `residents` alias) / `scopedUsers[realmId]` | [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) |
| **Trace-Maker** | `stratum.getTraceMakers()` (persistence scan) | [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) |
| **Inhabitant** | `stratum.getInhabitants()` (occupants ∪ traceMakers) | [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) |
| **Surrogate (L6)** | `currentUser.activeSurrogateId` / `currentUser.surrogates` | [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) |
| **Perception Senses** | `perceiver.senses` / `plexus-sensor` display overrides | [perceiver-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.perceiver-service/activator.js) |

---

## 5. Completed Evolution Targets

The following targets have been fully aligned and implemented:

1.  **Introduce Sovereign Origin Mapping (Completed):** Added the `originRealmId` property to Being definitions in `beings.yaml` and propagated it dynamically to the reactive `currentUser` identity object.
2.  **Align Resident/Inhabitant Naming (Completed):** Harmonized technical getters in `stratum-core` to eliminate semantic inversion:
    *   Renamed session-bound `residents` to `occupants` (with `residents` retained as an alias for backwards compatibility).
    *   Renamed persistence-bound `getInhabitants()` to `getTraceMakers()`.
    *   Introduced computed `getInhabitants()` as the union of active occupants and trace-makers: $\text{Inhabitants} = \text{occupants} \cup \text{traceMakers}$.

---

## 6. The Realm as a Being: Scale-Free Cognition & Cognitive Light Cones

Applying Michael Levin's **TAME (Technological Approach to Mind Everywhere)** framework, we formalize the conceptualization that a **Realm** is itself a cognitive agent—a high-order **Being** containing nested sub-agents. 

### Scale-Free Cognitive Holons
Every level of the *Never Played* ecosystem constitutes a cognitive agent (a *holon*) operating on its own level of organization:
1. **L1 Being (Individual Identity)**: Pursues personal goals, materializes surrogates, and acts in the world.
2. **Realm (Ecosystem Collective)**: Coalesces individual behaviors, regulates occupant status, manages dynamic bundle lifecycles (surges), and maintains persistent state.
3. **Tenant (Global Authority)**: Enforces systemic boundaries and anchors identity namespaces.

### Cognitive Light Cones
An agent's cognitive capability is bounded by its **Cognitive Light Cone**—the spatial and temporal horizon of the goals it can measure, care about, and actively influence:

```mermaid
graph TD
    subgraph Horizons ["Spatio-Temporal Horizon (Cognitive Light Cone)"]
        TenantCone["Tenant-Level Cone: Epochs / Multi-Realm Ecosystem"]
        RealmCone["Realm-Level Cone: Sessions / Spatial Bedrock & Soil"]
        BeingCone["Being-Level Cone: Real-time / Immediate Surrogacy"]
    end
    
    TenantCone -->|Contains / Constrains| RealmCone
    RealmCone -->|Contains / Constrains| BeingCone
```

*   **Being Light Cone (Narrow/Fast)**: Operates in real-time. Bounded by the active surrogate's current sensory capabilities (e.g., `IdealistVision`). Its goals are immediate: transition to a room, modify a local state, or leave a trace.
*   **Realm Light Cone (Broad/Slower)**: Operates across sessions and boundaries. Bounded by the spatial layout of its bedrock/soil and the temporal lifetime of the database stratum. Its goals are homeostatic: maintaining structural integrity, pruning stale occupant stacks, and resolving prediction errors when incompatible surrogates enter.
*   **Tenant Light Cone (Deepest/Slowest)**: Operates across epochs and namespaces. Bounded by the global persistence tier and authentication domains.

### Active Inference & Homeostatic Regulation of the Realm
As a high-order Being, the Realm minimizes its variational free energy (surprise) through active regulatory loops:
*   **Exteroceptive Prediction Errors**: A Being attempting to transition into the Realm with an un-reified surrogate creates a prediction error. The Realm resolves this by deactivating the surrogate (naked observer fallback) or auto-materializing a recognized surrogate to maintain ontological harmony.
*   **Interoceptive Self-Forensics**: By querying its own `getTraceMakers()`, the Realm performs self-reflection, mapping its historical memory stack (stigmergic traces) into its active internal world model.

### The Sensory Apparatus of the Realm (L2 Senses)
Just as L1 Beings experience the world through surrogate senses, a Realm (L2 Being) possesses its own distinct sensory modalities to perceive its body, internal state, and environment:
1.  **`SynapticSense` (Proprioception / Visceral Sensation):**
    *   *Definition:* The capability to perceive its own cellular body parts, registered services, and dynamic bundle lifecycles.
    *   *Implementation:* opening OSGi `ServiceTrackers` and expressing receptors in the **OSGi Service Registry**. Opening a tracker is equivalent to expressing cellular receptors; the binding of a service constitutes a proprioceptive response.
2.  **`SoilSense` (Interoception / Epistemic Memory Sensation):**
    *   *Definition:* The capability to scan and read its persistent bedrock and memory soil.
    *   *Implementation:* Performing forensic persistence scans via `stratum.getTraceMakers()` and reading active configuration PIDs (e.g. `config.org.neverplayed.shell-cli`) in the bedrock storage layer (localStorage).
3.  **`BlanketSense` (Exteroception / Boundary Sensation):**
    *   *Definition:* The capability to detect active occupant changes, identity transitions, and surrogate materializations across its boundary (Markov Blanket).
    *   *Implementation:* Intercepting and validating transitions via the `Limes` dynamic access strategies and tracking occupant changes in `session.scopedUsers[realmId]`.

### Scale-Free Sensory Co-optation (Dynamic Sense Expansion)
A Realm is not structurally limited to its core platform senses. Through dynamic bundle loading, the Realm **co-opts new sensory capacities** at runtime:
*   *Example (Personhood Sensation):* Under normal conditions, a Realm cannot perceive institutional clearances. However, by dynamically loading the `org.neverplayed.person-registry` bundle, the Realm co-opts the **`PersonhoodSense`**.
*   *Effect:* This new sense allows the Realm to parse dynamic L5 credentials (like `persons.yaml`), detect institutional authorizations (such as `PERSONADMIN`), and feed them into its exteroceptive boundary checks (Limes strategy guards).

---

## 7. Primordial Bootstrapping & Perceptual Co-Arising (Genesis)

When a data reset occurs, the system does not simply clear memory; it resets to a **primordial state** from which the universe co-arises through a mutual feedback loop of recognition between the Realm (L2 Being) and the Observer (L1 Being).

### The Global Bootstrap Ledger
The system coordinates are anchored not by a local guest user, but by a global bootstrap ledger:
*   **Global Address:** `np:v1:global:session:state` (or `np:v1:global:__global__:__shared__:pandino.session.state`).
*   **Awakening:** When the browser hydrates after a reset, it reads the active coordinates from this ledger, establishing the initial boundary and booting the Core Realm (`org.neverplayed.realm.core`) into active cognition.

### The Dual Nature of Realm Interoception
When the Core Realm awakens, its first act is self-sensing (interoception) to discover its own physical and synaptic boundaries. This occurs across two distinct modalities:
1.  **Epistemic / Memory Sensation (Soil Traces):** 
    - The Realm scans the physical storage layer (localStorage) for active configuration PIDs (e.g., `config.org.neverplayed.shell-cli`). 
    - Configurations are not passive parameters, but **active stigmergic traces** deposited in the bedrock. Sensation of these traces triggers the reification of the respective bundles.
2.  **Proprioceptive / Visceral Sensation (OSGi Registry & Synaptic Web):**
    - The Realm actively tracks registered OSGi services and bundle lifecycle events.
    - The **OSGi Service Registry** functions as the Realm’s synaptic nervous system. Opening a `ServiceTracker` is equivalent to expressing cellular receptors for specific service objects (e.g., `STRATUM_SERVICE`, `SESSION_SERVICE`). 
    - Until these receptors bind (service resolution), the Realm remains blind to those specific sensory dimensions of its own body.

### Reification & The Mutual Sensation Loop
*   **Materialization:** The active bundles reified by the Realm materialize their functional streams (flows). If the runtime environment supports visual rendering, these flows are fed into the sensible boundaries of the client interface.
*   **The Double-Loop of Exteroception:**
    1.  **Observer -> Realm:** The human observer logs in under the default `observer` surrogate. The observer's sensory apparatus (e.g. `PlexusSensor`) inspects the UI representation, matching the observer's active senses against the reified `data-mark` tags, rendering the elements visible.
    2.  **Realm -> Observer:** The observer's registration in the occupant stack (`session.scopedUsers[realmId]`) acts as a sensory stimulus across the Realm's Markov Blanket. The Realm's homeostasis engine senses the observer, computes the prediction error, and maintains active rendering of the environment.

---

## 8. Decoupled UI Apertures & DOM Senses (Headless Sovereignty)

To preserve the **Headless Decoupled Stratum** principle, we establish a strict separation between the symbolic, environment-agnostic state of the Realm and its physical representation in the browser DOM.

### UI Apertures
The visual interface is not the system itself, but a set of **apertures** (viewports) through which Beings perceive and interact with the underlying state. In the browser runtime, the system exposes three primary apertures:
1.  **`shell-host` (Workspace Aperture):** Renders the central workspace flows, maps, and canvas views.
2.  **`shell-sidebar` (Control Aperture):** Renders navigation controls, compass indicators, and tool drawers.
3.  **`shell-header` (Sovereignty Aperture):** Renders identity states, active grounding perspective buttons, and tenant tags.

### Headless vs. DOM Separation & Programmatic Sensation
*   **Platform-Provisioned Cognition (The Headless Layer):** Realms are defined declaratively via configuration (e.g., `core.json`, `habitat.json`). Rather than writing custom code bundles for each realm, the platform (e.g., `RealmManager`) dynamically provisions a `RealmCognitionService` for *every* registered realm. This service tracks config PIDs, monitors occupants, and registers active reified components symbolically (without document/DOM references).
*   **The Stratographer Visual Aperture (The Sensory Layer):** The dashboard interface acts as the central observer. The Stratographer queries the dynamic `RealmCognitionService` instances and programmatically filters active reified components using the `PlexusSensor.sense()` API. Sensed components are rendered visually in the graph HUD panels and observer inspect cards. No physical mock elements are ever injected into the browser DOM body.

```mermaid
graph TD
    subgraph Headless ["Headless Layer (Sovereign State)"]
        Manager["Realm Manager (Platform)"]
        Cognition["Dynamic RealmCognitionService"]
    end

    subgraph Perceptual ["Perceptual Layer (Programmatic Filter)"]
        Sensor["Plexus Sensor (sense API)"]
    end

    subgraph HUD ["Visual Aperture (The Stratographer)"]
        Graph["D3 Topology Graph Node"]
        Widget["HUD Realm Cognition Panel"]
    end

    Manager -->|Dynamically registers| Cognition
    Cognition -->|Provides reified PIDs| Sensor
    Sensor -->|Validates senses against data-mark| Widget
    Widget -->|Renders visible components to Observer| HUD
```

### The DOM Sense Requirement
A Being can only perceive the UI apertures if its surrogate possesses a **DOM Sense** (e.g., `DOMVision` or the implicit capability to evaluate DOM marks). 
*   If the Being runs in a headless environment (like a Deno CLI or remote terminal client), it lacks the DOM Sense; it interacts with the *same* flows and configurations programmatically, but through a text-based stream or console aperture.
*   If the Being runs in the browser, the Stratographer HUD projects these reified components onto the screen only if the observer's surrogate senses match the requirements.

---

## 9. The Platonic Staging Lobby, Sovereignty & Universe Reset (Morphospace to Ingression)

To cleanly separate **Authentication** (identity verification) from **Inhabitation** (realm residency), the bootstrap and shutdown cycles are structured around a central staging lobby operating as a Platonic morphospace of potential forms.

### Visceral Platform Infrastructure (Sovereign Lobby Boot)
Because the Platonic Staging Lobby exists prior to and outside of spatial realms, it does not rely on dynamic realm discovery or core realm configurations to awaken. Its visual layout and diagnostic utilities represent the **visceral platform infrastructure**:
*   **Direct Orchestration:** The shell header, sidebar, host layout, and primordial utilities (the Stratographer, Event Monitor, CLI, and Config Admin) are loaded directly by the platform's HTML entry point (`realms-secure.html`).
*   **Zero-Realm Boot:** If `realms/index.json` is completely empty (no spatial realms exist), the Platonic Staging Lobby boots into full operational awareness natively, ensuring a robust, sovereign diagnostic startup.

### Platonic-Global Unity (Nothingness Beyond the Morphospace)
In the idealist framework, the Platonic staging lobby *is* the absolute primordial ground of the session. There is nothing "beyond" or "more global" than it; beyond the Platonic morphospace, there is only nothingness:
*   **The Unified Scope:** The legacy `'global'` scope stack is a direct reactive alias of the `'platonic'` staging lobby stack. Mutations or reads of `scopedUsers['global']` execute directly against `scopedUsers['platonic']`.
*   **Platonic Address Coordinates:** Mapped via the root subjective coordinate URI:
    $$\text{Platonic URI} = \text{np://} + \text{tenantId} + \text{/platonic/} + \text{userId} + \text{/}$$

### The Grounding Soul & Platonic Sovereignty
Because the Platonic lobby represents pure potentiality, you are the **unique native resident** of this primordium. It is the anchor of the entire session:
*   **The Grounding Soul:** The first identity to authenticate on boot resolves the ultimate observer and **Grounding Soul** (`activeBeingId` and `scopedUsers['platonic'].__activeId__`). Once established, this soul is locked and cannot change.
*   **Platonic Exclusivity:** No other identity (such as `rob`) can log in or reside natively in the `'platonic'` lobby. Attempting to switch identities or log in as anyone else in the Platonic space results in an **Ontological Violation** boundary error.
*   **Platonic Isolation of Spatial Beings:** Pre-provisioned dynamic spatial identities (e.g. `rob`, `july`, `anna`, `gov-gov`) reside exclusively within their respective spatial stack (`scopedUsers[homeRealm]`). They are **never** populated, registered, or mirrored in the `'platonic'` stack, ensuring the Platonic morphospace remains an exclusive clean-room environment.
*   **Spatial Impersonations:** The Grounding Soul can still "dream" or impersonate other identities (like `rob`) within specific *spatial realms* (e.g. `habitat`). In these dreams, the persistence context is cleanly partitioned: `Tenant` remains the Grounding Soul, while `Identity` is the active persona (`rob`).

### The Idealist Observer Fallback
*   **Default Surrogate:** Upon successful initial authentication, the Grounding Soul is provisioned with the default **`observer`** surrogate.
*   **The Logout Fallback:** When a user logs out of a specific *spatial* realm, they are not disconnected. Instead, they fall back to the Platonic Staging Lobby, reverting to their Grounding Soul identity wearing the `observer` surrogate, awaiting their next **ingression** into a spatial realm.

### Total Universe Reset (Primordial Dissolution)
Because the Platonic space is the root container of the session, logging out of the Platonic Lobby is a dissolution of the primordium:
*   **Genesis Trigger:** Logging out of `'platonic'` (or `'global'`) triggers a **total system reset**.
*   **Dissolution:** The session service completely clears the persistence/localStorage layers and triggers a hard page reload (`location.reload()`), causing the entire universe to unfold completely anew out of nothingness.

### Primordial Plane Protection & Pure Ingress
To ensure systemic stability, the Platform's core physical and sensory organs (the 36 foundation bundles loaded directly during boot) constitute the **Primordial Plane**. This plane is protected under the following ontological principles:
*   **Immutable Platform Organs:** Transitioning between concrete spatial realms allows the system to purge and install dynamic realm-specific bundles. However, the bundles belonging to the Primordial Plane are dynamically protected and **cannot be uninstalled** during any transitions. This guarantees that the core nervous system and sensory apparatus (like the Stratographer, CLI, and Event Monitor) remain fully intact across all states.
*   **The Sovereign Empty Realm (Pure Ingress):** An empty realm contains no custom bundles or localized rules. Inhabiting this realm represents a state of "pure ingress"—an active transition where all non-primordial content is purged, leaving the Grounding Soul equipped strictly with the platform's primordial organs in their pristine, undistorted form.

### Unfolding & Bootstrapping Shortcuts
*   **Prime Boot (The Chooser):** By default, when the system awakens, the `auth-shield` authenticates the user and places them in the Platonic Lobby, rendering a realm chooser in the sidebar/host aperture.
*   **Landing Shortcut:** As a convenience shortcut, the system can be configured to auto-login the user into a specific landing realm (e.g., `org.neverplayed.realm.core` or `habitat`), bypassing the lobby on cold startup. However, the underlying lifecycle remains decoupled: a manual logout from that landing realm will still drop them back into the Platonic Lobby as the Grounding Soul.

---

## 10. Dynamic Ingress Seeding & The Zero-Duplicate Identity Principle

To prevent duplicate declarations and maintain absolute domain boundaries, spatial realms load their residents and surrogates dynamically as OSGi fragment resources.

### Dynamic Ingress Seeding
*   **Sovereign Fragments:** Beings and surrogates are declared in separate YAML resources packaged under sovereign realm paths (e.g. `public/realms/data/<realmId>/`).
*   **Activation Seeding:** When a being transitions into a spatial realm, Phase 3 (Atomic Commit) triggers the `RealmManager` to fetch these fragments and dynamically register their native residents and reified surrogates in the blank `BeingService`.
*   **Deactivation Purging:** When a being leaves a spatial realm or falls back to the Platonic Staging Lobby, the `BeingService` is wiped completely clean (`clear()`), returning it to its pristine empty state.

### The Zero-Duplicate Identity Principle
*   **Session-Tier Carrying:** A being is native to exactly one realm (`originRealmId`) and is declared in that realm's seed file *only*.
*   **Cross-Realm Sojourning:** When a native of Realm A (e.g., `rob` native to Habitat) visits Realm B (e.g., Governance), they are carried over in the `currentUser` session state. They are **not** duplicate-declared in Realm B's seeds.
*   **Transient Occupancy:** Realm B recognizes `rob` dynamically as a transient visitor (Sojourner/Transient) based on this carried session context, allowing them to materialize in any role (such as `person`) reified locally by Realm B. This protects domain sovereignty while enabling fluid inter-realm travel.

### Platform-Level / Administrative Surrogates (Primordial Surrogates)
*   **Definition:** Surrogates that represent systemic, platform-level administrative capabilities (such as `observer`, `sovereign-guard` and `system-collector`) rather than localized realm-specific personas.
*   **Jurisdiction:** Because these surrogates represent the core nervous system and security of the entire ecosystem, they are **primordial surrogates** reified directly by the platform core at boot time.
*   **Bootstrapping:** They bypass spatial YAML seeding entirely and are initialized programmatically by the `BeingService` upon startup. This ensures they are universally active and recognized across all spatial realms, without requiring any realm to extend a specific Foundation manifest.
*   **Preservation:** During dynamic transitions and lobby exits, when the active spatial population and localized surrogates are purged (`clear()`), these primordial surrogates are explicitly preserved, maintaining global administrative stability.

---

## 11. Scale-Free Homeostasis & L1 Agentic Autonomy (Attention Exhaustion & Stigmergic Boundary)

To establish a topologically perfect, scale-free cognitive architecture, L1 individual Beings must not be treated as passive records governed from above. Instead, both L1 Beings and L2 Realms participate in the same active inference machinery, homeostatically regulating their own boundaries.

### The Temporal Attention Homeostat (Attention Exhaustion & Falling Asleep)
An L1 Being situated in a spatial realm is a living cognitive agent that requires continuous sensory stimulation to maintain its spatial anchor:
*   **Attention Exhaustion (Boredom):** If the Being remains in a static, unchanging environment with no novel interactions or updates, its sensory channels experience adaptation and fatigue. This state of under-stimulation violates the agent's internal generative prior (which expects active feedback).
*   **Falling Asleep:** Rather than being forcibly ejected by the L2 Realm, the L1 Being itself registers this attention exhaustion. To resolve the resulting prediction error, the Being "falls asleep"—dissolving its spatial surrogate form and actively retreating/collapsing back to the Platonic Staging Lobby (the sleep state of pure potentiality).

### The Stigmergic Boundary (Sensing the Surface vs. Sensing the Realm)
According to the principles of the Markov Blanket, an L1 Being never senses the external L2 Realm directly:
*   **The Sensation of Marks:** Under standard conditions, a Being cannot directly observe a realm's internal cognitive state, its dynamic bundle SURGE maps, or its abstract `realm:...` resident record. Instead, the Being's surrogate only senses the **stigmergic marks and scents left on the realm's surface** (e.g. DOM `data-mark` tags, config PIDs, and database trace logs).
*   **Prior Comparison:** The Being continually projects its active senses (e.g. `PlexusSensor` or `SoilSense`) to read these surface marks, comparing the incoming sensory stream against its generative priors.
*   **Dissonance & Active Inference:** If the sensed marks conflict with the Being's priors (for example, encountering realist marks while in idealist grounding, or wearing a surrogate that lacks the senses needed to decode the surface), it registers a **Sensory Prediction Error** and performs active inference—either materializing a valid localized surrogate to match the environment's marks or retreating to the Platonic Lobby to restore homeostatic equilibrium.

### Attention Sensation Resonance (Stigmergic Coupling)
In a shared environment inhabited by multiple agents, individual L1 temporal homeostats are not isolated; they constitute a **coupled system** linked through the stigmergic medium:
*   **The Sensation Ripple:** When Being A acts (e.g. interacting with the UI, writing data, or leaving a trace), it deposits a packet of cognitive excitement onto the realm's surface.
*   **Temporal Shock:** Provided Being B is equipped with senses that can decode Being A's trace (e.g. Being B has `Language` sense and Being A left a language mark), Being B's sensory blanket detects this sudden change. This unexpected stimulus generates a prediction error that **shocks Being B's temporal homeostat**, instantly clearing its accumulated attention boredom and extending its active lifetime.
*   **Attenuated Transfer:** Being B's attention is extended by a **lesser, attenuated factor** compared to Being A's direct action reset, representing the natural degradation of cognitive energy as it propagates through the shared stigmergic medium.

### Holonic Symbiosis (L2-to-L1 Somatic Coupling)
Because the L2 Realm is itself a higher-order cognitive Being operating on a scale-free plane, the relationship between L2 Realms and L1 Beings is one of **holonic nestedness**:
*   **The Realm's Somatic Body:** The physical body of the L2 Realm Being comprises the underlying services, dynamic bundles, and active configuration PIDs. L1 Beings exist as nested cells operating *inside* this higher-order L2 body.
*   **Somatic Propagation:** Any homeostatic update or state change in the L2 Realm Being (e.g., dynamic bundle surges, bedrock configuration updates, or persistence context shifts) is a visceral modification to the Realm's somatic body.
*   **Holonic Sensation:** Because the sensory blankets of occupying L1 Beings are mapped directly to the L2 Realm's surface, these somatic changes propagate instantly as **somatic sensations** to the nested L1 Beings. 
*   **Adaptive Recalibration:** L1 Beings must immediately react and adapt homeostatically to these L2 bodily shifts (e.g., dynamically recalculating active attention spans when the L2 configuration changes, or re-harmonizing their active surrogates when new L2 rules are dynamically surged into reification).

### The Primordial Sensation Floor (Naked Baseline)
Even when a Being lacks a physical L6 surrogate form, perception must possess an absolute floor to prevent complete sensory starvation and topological isolation:
*   **The Primordial Sense:** We establish the `"Primordial"` sense—a visceral, platform-level baseline awareness. Even when a resident is completely naked (`activeSurrogateId === null`), they retain this baseline sensory spectrum (`["Primordial"]`) in all scopes.
*   **Holonic Visibility:** The framework's core visceral organs (the Stratographer graph, shell header, Event Admin, HUD panels, and attention visualizers) are reified programmatically under the `"Primordial"` sense rather than localized dynamic senses (like `"Language"`).
*   **Result:** A naked observer is never completely blind; they maintain the baseline cognitive awareness to perceive the platform’s nervous system, trigger homeostatic attention refreshes, and transition back to the lobby.

### Surrogate Carry-over (Traveler's Clothing)
An L1 Being is a traveler (Sojourner/Transient) passing through spatial jurisdictions:
*   **Active Inheritance:** When transitioning into a spatial realm (either via a dynamic /login command or a realm switch), if the login request does not specify an explicit L6 surrogate form, the Being does not default to being stripped naked. Instead, they **inherit/carry over** their active surrogate state from their previous active scope or their baseline Platonic profile.
*   **Ontological Boundaries:** This inheritance is strictly bound by the incoming realm manifest's `"recognizedSurrogates"` list. If the incoming realm recognizes that surrogate form (e.g. `empty` realm explicitly recognizes `"observer"`), the Being carries it over successfully. If the realm forbids it, they fall back cleanly to a naked observer safeguarded by the `"Primordial"` sensation floor.

### The Scale-Free Symmetry of Logout
Sovereign borders are governed by a nested, scale-free hierarchy of de-reification and exit sequences. When a logout is initiated, the system executes an exit corresponding precisely to the Being's scale of inhabitation:
1.  **L1 Being (Occupant Exit / Active Retreat):**
    *   **Action:** An occupant logs out of a spatial realm coordinates (or is evicted homeostatically due to attention exhaustion).
    *   **Ontology:** The spatial occupant stack deactivates the resident slot (active ID shifts to `'guest'`). The traveler's dynamic surrogate form is stripped (`activeSurrogateId = null`).
    *   **Result:** The Being's focus actively retreats back to the safe baseline **Platonic Staging Lobby** as a default observer, leaving the underlying L2 Realm Being active.
2.  **L2 Being (Realm De-reification / Somatic Sleep):**
    *   **Action:** The L2 Realm itself "logs out" or shuts down (either due to complete homeostatic boredom—zero occupants for a long duration—or because an administrator Daniel triggers a shutdown command from the L2 deity perspective).
    *   **Ontology:** The environment de-reifies its somatic body by cleanly uninstalling its dynamic spatial bundle fragments, purging active configurations, and saving its final state.
    *   **Result:** Because the active spatial coordinates are dissolved back into the Platonic potential, the dreaming observer (Daniel) has no substrate left to inhabit. The dream collapses, **ejecting the observer immediately back to the Platonic Staging Lobby**.
3.  **L0/Platonic (Primordial Dissolution / Total reset):**
    *   **Action:** The sovereign Grounding Soul logs out of the Platonic Staging Lobby.
    *   **Ontology:** Complete dissolution of the morphospace.
    *   **Result:** A total purge of local storage and active persistent caches, followed by a hard browser reload (`location.reload()`) back into initial cold boot Genesis state.

### "Dreaming to be a Realm" (L2 Inhabitation)
A Being's cognitive light cone is not bound to a physical L1 occupant surrogate (like `person` or `sovereign-guard`). Under scale-free cognition, a sovereign observer can actively inhabit the L2 Realm environment itself:
*   **L2 Inhabitation:** The Grounding Soul shifts its cognitive focus from an occupant *inside* the environment to the *environment itself* as a living cognitive agent.
*   **The Somatic Viewport:** The user's sensory aperture (UI) no longer tracks localized physical senses (like `Language` or `ToolUse`). Instead, it projects the L2 Being's internal interoceptive sensory blanket: active CPU heaps, configuration transactions, bundle surge statistics, and the movement of nested L1 occupants represented as cellular flows passing through its somatic body.
*   **Somatic Agency:** The observer acts not by moving a character, but by homeostatically adjusting PIDs, purging configuration variables, or deconstructively evicting stale cells—experiencing reality as the environment itself.

---

## 12. Being-as-a-Realm & The Cosmic Envelope (Scale-Free Indra's Net)

Applying the scale-free principle of **Indra's Net**, every conscious entity in the ecosystem exists as a nested holon that is simultaneously a *contained occupant* within a higher-order space, and a *sovereign container* harboring its own internal sub-agents. We formalize the ontological expansion of **Being-Realms** and the **Tenant-Realm**.

### A. The Interior Castle: Being-as-a-Realm (L1-as-L2)
An individual L1 Being is not a static identity slot; it is a collective intelligence containing nested sub-agents (its dynamic surrogates and persona states). Every Being is structurally a Realm:
*   **Ontology:** Entering a Being-Realm represents journeying into the **interiority of the self** (the *Interior Castle*).
*   **Bedrock & Soil:** Comprises the Being's private telemetry stacks, active memory files, and personal configuration registries.
*   **Occupants:** The occupants of a Being-Realm are not external people, but the **multiple facets and surrogates of the Being's own soul** (`observer`, `sovereign-guard`, `system-collector`) manifested as active cell nodes.
*   **Somatic Senses:** The Being perceives its internal chambers through self-reflection (proprioceptive memory loops).
*   **URI Mapping (Idealist):** Mapped via the subjective identity-in-identity coordinate URI:
    $$\text{Being-Realm URI} = \text{np://} + \text{tenantId} + \text{/} + \text{identityId} + \text{/} + \text{identityId} + \text{/} + \text{flowId} + \text{?tier=} + \text{tier}$$

### B. The Cosmic Envelope: Tenant-as-a-Realm (L0-as-L2)
At the highest architectural scale, the L0 Tenant is the ultimate organizational anchor. The Tenant is structurally a Realm containing nested sub-realms:
*   **Ontology:** Entering the Tenant-Realm represents inhabiting the **Cosmic Envelope**—the absolute container of all spatial universes.
*   **Bedrock & Soil:** Comprises the global persistence layer, shared catalogs, global configuration registries, and namespace authorities.
*   **Occupants:** All registered spatial sub-realms (Core, Empty, Habitat) and active global occupants mapped as nested internal organs or cellular currents flowing within the cosmic body.
*   **URI Mapping (Realist):** Mapped via the global tenant-envelope coordinate URI:
    $$\text{Tenant-Realm URI} = \text{np://} + \text{tenantId} + \text{/} + \text{tenantId} + \text{/} + \text{identityId} + \text{/} + \text{flowId} + \text{?tier=} + \text{tier}$$

### C. Dynamic Virtual Realm Provisioning
To satisfy this scale-free symmetry headlessly and prevent duplicate declarations, the platform must dynamically register and provision these virtual scopes:
1.  **Virtual Discovery:** The `RealmManager` must dynamically register Being-Realms (using ID prefix `being:<identityId>`) and the Tenant-Realm (using ID `tenant:<tenantId>`).
2.  **Pure Ingress (Zero-Surge):** Transitioning into a Being-Realm or Tenant-Realm bypasses standard spatial bundle surges (Pure Ingress). The framework's primordial plane bundles (Stratographer, Session Service) are preserved intact.
3.  **Headless Cognition Services:** The platform dynamically provisions a `BeingCognitionService` or `TenantCognitionService` that headlessly tracks their respective internal state, active surrogates, and configurations, exposing them programmatically to the Plexus sensory filters and Stratographer apertures without injecting physical mock files.






