# Session State: Development Engineer (dev)
_Last updated: 2026-08-23 — Workspace: `neverplayed-core` / `neverplayed`_

## Current Goal
- Core infrastructure extraction completed under ADR-0035.
- `neverplayed-core` operates as a standalone OSGi platform container on `http://localhost:8008`.
- Consumer realms in `neverplayed` operate on `http://localhost:8009` and dynamically inject into core via `?realm=...` query parameters.
- Ready for next development directives in either repository.

---

## Completed Items (this session)

### 1. ADR-0035 Multi-Workspace Decoupling
- Formulated, accepted, and encoded `ADR-0035: Multi-Workspace Infrastructure and Realm Decoupling`.
- Established the boundary between Invariant Priors (`neverplayed-core`) and Volatile Generative Models (`neverplayed-realms`).
- Established the Dual-Server local DX architecture (Core on :8008, Realms on :8009).

### 2. Static Server & Universal Host Harness
- **`serve.ts`**: Enhanced with robust port argument parsing (`--port=8008`, `--port 8008`, or `PORT` env var), permissive CORS headers (`Access-Control-Allow-Origin: *`), and global `OPTIONS` preflight handling.
- **Universal Container (`public/index.html`)**: Promoted `realms-secure.html` to root `index.html`. Implemented dynamic URL parameter parsing (`?realm=<url>` and `?manifests=<url>`) to install and start external realm bundles dynamically at boot via `context.installBundle()`.

### 3. Clone-and-Prune Core Extraction (`/Users/ddoegl/speckit/neverplayed-core`)
- Cloned the repository to `../neverplayed-core` preserving 100% of commit history and git blame.
- Promoted `public/realms-secure.html` -> `public/index.html`.
- Pruned legacy entry points (`barebones.html`, `mini.html`, etc.).
- Deep-pruned domain realm descriptors (`habitat.json`, `gym.json`, `governance.json`, `somatic-body.json`, `gemma.json`, `real-life.json`, `work.json`, etc.) and data directories from `public/realms/`.
- Configured `public/realms/index.json` to only load `["empty.json"]` (Platonic Staging Lobby baseline).
- Pruned domain and cognitive bundles (`org.neverplayed.gym`, `somatic-body`, `llm.inner-voice`, `llm.gemma-provider`, `outreach`, `action-registry`, `do-registry`, `atomic-orchestrator`, `person-registry`, `governance.registry`, `yaml-editor`, `agent.antigravity`, `environments/`).

### 4. Test Suite & Linters Validation in `neverplayed-core`
- Updated `tests/run-all.ts` to isolate core platform tests: **18/18 tests PASSED 100% green**.
- Layered architectural linters (`lint:arch:core`, `lint:arch:foundation`): **0 violations**.
- Closed handover ticket `TICKET-20260823-1545-CORE-INFRASTRUCTURE-EXTRACTION` and archived to `closed/`.

### 5. Composite Realm Descriptor Ingestion & Dynamic Seed Data Resolution
- **Polymorphic Ingestion Protocol**: `index.html` dynamically distinguishes between composite Realm Descriptors (`habitat.json`), index catalog arrays (`index.json`), and standalone Pandino bundle manifests (`manifest.json`), supporting `?realms=`, `?realm=`, `?bundle=`, and `?switch=`.
- **Multi-Origin Base URL Normalization**: `realm-manager` normalizes relative bundle paths and seed data YAML fragments (`beings.yaml`, `surrogates.yaml`) against remote origin (`http://localhost:8009/`), resolving cross-origin assets during transition.
- **Documentation & ADRs**: Updated `ADR-0035` (Decoupling Protocol) and `ADR-0007` (Dynamic Fragment Seeding).
- **Automated Regression**: Added `tests/remote-realm-ingestion.test.ts` and verified in `tests/run-all.ts` (18/18 green).

### 6. Realm Catalog & Sovereignty Cleanup
- **`neverplayed-core`**: Removed obsolete `core.json` and `foundation.json`. `public/realms/index.json` strictly serves `["empty.json"]`.
- **`neverplayed`**: Removed obsolete `core.json` and removed `empty.json` from `neverplayed/public/realms/index.json` to prevent overwriting host Platonic baseline during remote discovery.

---

## Key Decisions & Architecture Reference

### Universal Injection Protocol
- To discover and load the entire actionable catalog in one go:
  `http://localhost:8008/?realms=http://localhost:8009/realms/index.json`
- To discover all realms and auto-land on Habitat:
  `http://localhost:8008/?realms=http://localhost:8009/realms/index.json&switch=org.neverplayed.realm.habitat`
- To boot the core and load a single composite realm with its seed data:
  `http://localhost:8008/?realm=http://localhost:8009/realms/habitat.json&switch=true`
- To inject an individual standalone bundle:
  `http://localhost:8008/?bundle=http://localhost:8009/bundles/org.neverplayed.realm.habitat/manifest.json`

### Port Allocation
- `neverplayed-core`: Port `8008` (starts via `deno task start` or `deno run -A ./serve.ts --port 8008`).
- `neverplayed` (Realms): Port `8009` (starts via `deno run -A ./serve.ts --port 8009`).

### Repository Split & Remote Links
- Core Repo: `https://github.com/ddoegl/neverplayed-core.git` (branch `main`).
- Realms Repo: `https://github.com/ddoegl/neverplayed.git` (branch `architectural-cleanup-1`).
- Historical Session Deep Link: `[Previous Migration Session](conversation://39904400-ee76-4131-9a14-93d9200ee149)`.
