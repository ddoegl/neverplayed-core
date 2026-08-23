# ADR-0035: Multi-Workspace Infrastructure and Realm Decoupling

**Status:** Accepted

## Context

The Never Played runtime has matured into a stable, headless substrate (anchored by `realms-secure.html` alongside the core Pandino OSGi bundles, persistence strata, session/privilege sovereignty, and the diagnostic shell).

Currently, this invariant platform substrate resides in the same repository as concrete realms (`realm.habitat`, `realm.gym`), spatial seed data (`data/beings.yaml`), experimental business flows (`flows/*`), and cognitive LLM sidecars.

In active inference terms, this mixes the **invariant deep priors** (the OSGi framework, persistence selector, session sovereignty, stratum coordinates, and limes) with **volatile generative representations** (spatial mechanics, UI themes, narrative inner-voice prompts). This monolithic coupling creates three significant friction points:
1. **Regression Vulnerability**: Domain experimentation risks destabilizing core kernel mechanics and test suites.
2. **Release Tangling**: Infrastructure fixes cannot be released or versioned independently from experimental realm prototypes.
3. **OSGi Underutilization**: Pandino's native ability to dynamically resolve and mount decentralized bundles across arbitrary URIs (CDNs, separate servers) is obscured by relative local path dependencies.

## Decision

We will decouple the Never Played ecosystem into a dual-workspace architecture using a **Clone-and-Prune Git strategy** (ensuring 100% commit history and blame preservation for both repositories):

1. **Dedicated Core Infrastructure Repository (`neverplayed-core`)**:
   - **Universal Host Harness (`index.html`)**: The mature `realms-secure.html` becomes the root `index.html` of `neverplayed-core`.
   - **Dynamic Realm Injection**: The `index.html` harness parses URL query parameters (e.g. `?realm=http://localhost:8009/bundles/.../manifest.json` or `?manifests=http://localhost:8009/manifests.json`) and declarative `env.json` endpoints to dynamically install external realm bundles via Pandino's `context.installBundle()`.
   - **Bedrock & Shared Contracts**: `osgi-base.js`, `alpine-base.js`, `core-types.js`.
   - **Persistence Stratum**: `persistence-localstorage`, `persistence-firebase`, `persistence-selector`, `persistence-resolver`, `persistence-fs-sync`.
   - **Identity & Sovereignty**: `session-service`, `session-service-dom`, `auth-shield`, `limes`.
   - **Universe Management**: `realm-manager`, `realm-manager-dom`, `perceiver-service`, `being-service`.
   - **Strata & Sensation Bedrock**: `stratum-core`, `stratum-core-dom`, `stratum-hud`, `plexus-core`, `plexus-sensor`, `plexus-enricher`.
   - **Shell, Overlays & Diagnostic Lobby**: `shell-host`, `shell-header`, `shell-sidebar`, `shell-cli`, `toast`, `system-reset`, `config-admin`, `event-monitor`.
   - **Documentation & Governance**: ADRs 0001–0035, active inference ontology, architectural linters (`lint-arch.ts`), and kernel regression suites (`tests/*`).

2. **Consumer Realm Repository (`neverplayed-realms` / `neverplayed`)**:
   - **Concrete Realms**: `org.neverplayed.realm.habitat`, `realm.real-life`, `realm.gym`, `realm.somatic-body`, etc.
   - **Spatial Seed Data & Assets**: `beings.yaml`, `surrogates.yaml`, 3D models, canvas assets.
   - **Domain Flows & Showcases**: `flows/*`, `user-clients/*`, `system-services/*`, `visual-editor`.
   - **Cognitive & Sidecar Models**: `org.neverplayed.llm.inner-voice`, Gemma showcase, external inference connectors.
   - **Ultralight Structure**: Realm repositories do not require full HTML shell harnesses or local substrate duplication; they serve modular bundles loaded into the Core container.

3. **Dual-Server Local Development Experience (DX)**:
   - The Core workspace executes a local Deno server on port `8008` (`http://localhost:8008`) serving static bundles and ESM modules with permissive CORS headers (`Access-Control-Allow-Origin: *`).
   - The Realms workspace executes a local static server on port `8009` (`http://localhost:8009`).
   - Developers test realms simply by visiting:
     `http://localhost:8008/?realm=http://localhost:8009/bundles/org.neverplayed.realm.habitat/manifest.json`

4. **Documentation & Agent Workflow Federation**:
   - Platform ADRs and basal ontology remain canonical in `neverplayed-core/docs/`.
   - Domain rules, spatial lore, and mechanic specs reside in `neverplayed-realms/docs/`.
   - The `.agents/` persona and memory system operates identically in both repositories, using cross-repo handover tickets when domain requirements necessitate platform substrate evolution.

## Consequences

- **Positive (System Stability)**: Core infrastructure gains absolute isolation; tests in `neverplayed-core` validate only pure substrate invariant loops without domain noise.
- **Positive (Decentralized OSGi Validation)**: Fully exercises Pandino's multi-origin bundle resolution, aligning with the foundational architecture.
- **Positive (Velocity)**: Realm creators can iterate, break, and refactor spatial mechanics without risking the underlying operating system.
- **Negative (Cross-Repository Coordination)**: Modifying foundational contracts (`core-types.js`) requires updating and testing the core repository before consuming the changes in realms.
- **Negative (Local DX Setup)**: Developers hacking simultaneously across the kernel and a realm must keep both local Deno servers running.
