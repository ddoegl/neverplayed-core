# Handover Ticket: Multi-Workspace Core Infrastructure Extraction

**Ticket ID:** TICKET-20260823-1545-CORE-INFRASTRUCTURE-EXTRACTION  
**From:** Cognitive Architect  
**To:** Development Engineer  
**Status:** OPEN  
**Ecosystem Branch:** `architectural-cleanup-1`  
**Governing ADR:** [ADR-0035: Multi-Workspace Infrastructure and Realm Decoupling](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0035-multi-workspace-infrastructure-decoupling.md)

---

## 1. Context & Architectural Mandate

In accordance with **ADR-0035**, the invariant Never Played platform substrate must be extracted from the monolithic codebase into a dedicated repository (`neverplayed-core`), establishing a decoupled, dual-workspace architecture.

The current repository (`neverplayed`) will transition into the consumer realm repository (`neverplayed-realms`), containing concrete spatial realms, domain business flows, YAML seed configurations, and LLM inner-voice sidecars.

During local development, both workspaces operate in tandem via dual Deno dev servers (`http://localhost:8008` for Core, `http://localhost:8009` for Realms) using cross-origin Pandino bundle fetching and ESM import maps.

---

## 2. Inventory Classification

### A. Core Platform Substrate (Moves to `neverplayed-core`)

1. **Foundational Types & Base Classes:**
   - `public/core-types.js` & `public/types/*`
   - `public/osgi-base.js`
   - `public/alpine-base.js`
   - `public/styles.css`
2. **Persistence Stratum:**
   - `public/bundles/org.neverplayed.persistence-localstorage`
   - `public/bundles/org.neverplayed.persistence-firebase`
   - `public/bundles/org.neverplayed.persistence-selector`
   - `public/bundles/org.neverplayed.persistence-resolver`
   - `public/bundles/org.neverplayed.persistence-fs-sync`
3. **Session, Identity & Security Sovereignty:**
   - `public/bundles/org.neverplayed.session-service`
   - `public/bundles/org.neverplayed.session-service-dom`
   - `public/bundles/org.neverplayed.auth-shield`
   - `public/bundles/org.neverplayed.limes`
   - `public/bundles/org.neverplayed.plexus-core`
4. **Universe & Perception Management:**
   - `public/bundles/org.neverplayed.realm-manager`
   - `public/bundles/org.neverplayed.realm-manager-dom`
   - `public/bundles/org.neverplayed.perceiver-service`
   - `public/bundles/org.neverplayed.being-service`
5. **Strata, Sensation & Diagnostic Bedrock:**
   - `public/bundles/org.neverplayed.stratum-core`
   - `public/bundles/org.neverplayed.stratum-core-dom`
   - `public/bundles/org.neverplayed.stratum-cli`
   - `public/bundles/org.neverplayed.stratum-hud`
   - `public/bundles/org.neverplayed.plexus-enricher`
   - `public/bundles/org.neverplayed.plexus`
   - `public/bundles/org.neverplayed.plexus-sensor`
   - `public/bundles/org.neverplayed.plexus-tracing`
   - `public/bundles/org.neverplayed.plexus-test`
6. **Diagnostic Lobby, Shell & Overlays:**
   - `public/bundles/org.neverplayed.stratographer`
   - `public/bundles/org.neverplayed.toast`
   - `public/bundles/org.neverplayed.shared-ui`
   - `public/bundles/org.neverplayed.shell-host`
   - `public/bundles/org.neverplayed.shell-header`
   - `public/bundles/org.neverplayed.shell-sidebar`
   - `public/bundles/org.neverplayed.shell-cli`
   - `public/bundles/org.neverplayed.shell-cli-ext`
   - `public/bundles/org.neverplayed.shell-cli-dom`
   - `public/bundles/org.neverplayed.system-reset`
   - `public/bundles/org.neverplayed.config-admin`
   - `public/bundles/org.neverplayed.event-monitor`
   - `public/bundles/org.neverplayed.alpine-inspector`
   - `public/bundles/org.neverplayed.system-logger`
   - `public/bundles/org.neverplayed.yaml-service`
   - `public/bundles/org.neverplayed.alpine-bridge`
7. **Harness & Tooling:**
   - `public/realms-secure.html` (Reference boot harness)
   - `serve.ts` (Static dev server)
   - `scripts/lint-arch.ts` & architectural linter configs
   - Core unit and regression test suite (`tests/*`)

### B. Consumer Realm Domain (Stays in `neverplayed`)

1. **Concrete Spatial Realms:**
   - `public/bundles/org.neverplayed.realm.habitat`
   - `public/bundles/org.neverplayed.realm.real-life`
   - `public/bundles/org.neverplayed.realm.gym`
   - `public/bundles/org.neverplayed.realm.somatic-body`
   - Additional custom/experimental realms
2. **Spatial Fragment Data & Assets:**
   - `beings.yaml`, `surrogates.yaml`, 3D models, textures, canvas shaders
3. **Domain Flows & Showcases:**
   - `public/bundles/flows/*`
   - `public/bundles/user-clients/*`
   - `public/bundles/user-services/*`
   - `public/bundles/system-clients/*`
   - `public/bundles/system-services/*`
   - `public/bundles/org.neverplayed.visual-editor`
   - `public/bundles/org.neverplayed.atomic.showcase`
4. **Cognitive & Sidecar Models:**
   - `public/bundles/org.neverplayed.llm.inner-voice`
   - `public/bundles/org.neverplayed.llm.gemma-provider`
   - `public/bundles/org.neverplayed.llm.gemma-showcase`

---

## 3. Technical Objectives for Development Engineer

### Objective 1: Implement CORS & Static Server Enhancements
In `serve.ts`:
- Attach `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`, and `Access-Control-Allow-Headers: *` to all static asset and ESM module responses.

### Objective 2: Transform `realms-secure.html` into Universal `index.html`
In `public/realms-secure.html` (which becomes `public/index.html` in `neverplayed-core`):
- Add query parameter parsing on page load (`const params = new URLSearchParams(window.location.search)`).
- If `?realm=<url>` or `?manifests=<urls>` are provided:
  - Dynamically fetch and install the external bundle(s) via `context.installBundle(url)`.
  - Start the installed bundle(s) once the core platform signals `kernelReady`.
- Support multiple realms via repeated `?realm=` parameters or comma-separated lists.

### Objective 3: Create Clone-and-Prune Extraction Script
Create a migration script (e.g. `scripts/clone-and-prune-core.sh` or `scripts/extract-core.ts`) that:
1. Clones the current repository to a sibling directory `../neverplayed-core`.
2. In `../neverplayed-core`:
   - Renames `public/realms-secure.html` to `public/index.html`.
   - Deletes legacy/unneeded HTML entry files (`public/barebones.html`, `public/barebones-secure.html`, `public/mini.html`, old `public/index.html`).
   - Prunes domain bundles (`public/bundles/flows/`, `public/bundles/org.neverplayed.realm.*`, `public/bundles/user-*`, `public/bundles/system-*`).
   - Retains all substrate bundles, test suites, ADRs, and core linters.
   - Verifies `deno task test` passes 100% green in the new repository.

---

## 4. Verification Plan

### Automated Tests
1. In `neverplayed-core`: Run `deno task test` and `deno task lint:arch:core` / `foundation` / `domain` to ensure 100% green pass in isolation.

### Manual Verification
1. Launch the Core server on port `8008`: `deno run -A ./serve.ts --port 8008` (in `neverplayed-core`).
2. Launch a static server on port `8009` (in `neverplayed-realms`).
3. Open `http://localhost:8008/?realm=http://localhost:8009/bundles/org.neverplayed.realm.habitat/manifest.json` in a browser.
4. Verify that:
   - The Core initializes cleanly into the Platonic Lobby.
   - The remote Habitat realm is dynamically installed from `:8009`.
   - The Realm Switcher in the Shell Header reflects the Habitat realm and allows transitions seamlessly.

