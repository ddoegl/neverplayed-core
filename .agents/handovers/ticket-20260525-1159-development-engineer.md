# Developer Handover: Primordial Being Purity & Dynamic Spatial Seeding

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** 
  To enforce complete domain sovereignty and emulated OSGi fragment bundling, we are decoupling the population seeds from a central global database. The being-service boots as a primordial engine loaded programmatically with system-level primordial default surrogates. Beings and surrogates are loaded dynamically as spatial resource fragments by the `RealmManager` during realm ingress (Phase 3 transitions) and are completely purged upon exit, preserving only the primordial defaults.

---

## Actionable Objectives

### 1. Being Service Refactoring (Primordial Default Surrogates & Blank Engine)
* **File:** [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js)
* **Actions:**
  - Delete `_hydrateBeings()` and remove all active watchers on `PERSISTENCE_RESOLVER_SERVICE` or `YAML_SERVICE` inside the being service's startup lifecycle.
  - At startup, programmatically bootstrap and register the system's **primordial default surrogates**:
    - `observer` (Senses: `Language`)
    - `sovereign-guard` (Senses: `Language`, `ForensicVision`, `ArchitectControl`, `InhabitantGuardianship`)
    - `system-collector` (Senses: `Language`, `SpaceReclamation`)
  - Expose a dynamic API `registerBeings(beingsArray)` to dynamically load and register beings into `_beingsData` and update active session stacks if applicable.
  - Expose a dynamic API `registerSurrogates(surrogatesArray)` to dynamically register surrogates into `_surrogatesData`.
  - Expose a `clear()` API that purges all dynamic spatial data from `_beingsData` and `_surrogatesData`, but **explicitly preserves** the three primordial default surrogates (`observer`, `sovereign-guard`, and `system-collector`).

### 2. Realm Manager Refactoring (Dynamic Seeding & Purging)
* **File:** [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
* **Actions:**
  - Track `BEING_SERVICE` and `YAML_SERVICE` dynamically inside the startup trackers.
  - Modify `_switchRealm(context, realmId)` in Phase 3 (Atomic Commit / Activation):
    - If the realm manifest declares a `seedData` configuration:
      - Fetch the configured `seedData.surrogates` YAML fragment, parse it via `YAML_SERVICE`, and invoke `beingSvc.registerSurrogates(...)`.
      - Fetch the configured `seedData.beings` YAML fragment, parse it, and invoke `beingSvc.registerBeings(...)`.
    - If transitioning back to `'platonic'` (exiting a spatial realm), invoke `beingSvc.clear()` on the Being Service to dynamically wipe spatial residents and restore lobby cleanliness.

### 3. Spatial Seed Bundling (OSGi Fragments)
* **File Deletions:**
  - Delete [beings.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/beings.yaml)
  - Delete [surrogates.yaml](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/data/surrogates.yaml)
* **New File Creation (Habitat Fragment):**
  - Create [beings.yaml](file:///Users/ddoegl/speckit/neverplayed/public/realms/data/habitat/beings.yaml) containing all currently defined beings as Habitat natives:
    - `rob`, `july`, `anna`, `john`, `bactor`, `joemiller`, `sc-user-1`, `sc-admin`, `dd`.
    - Set `originRealmId: org.neverplayed.realm.habitat` for all of them.
  - Create [surrogates.yaml](file:///Users/ddoegl/speckit/neverplayed/public/realms/data/habitat/surrogates.yaml) reifying the `person` and `guest` surrogates.
* **New File Creation (Governance Fragment & Mascot PoC):**
  - Create [beings.yaml](file:///Users/ddoegl/speckit/neverplayed/public/realms/data/governance/beings.yaml) containing only native Governance residents:
    - `gov-gov`: A new identity native to Governance (`originRealmId: org.neverplayed.realm.governance`), possessing the `maskot` surrogate as its initial state.
  - Create [surrogates.yaml](file:///Users/ddoegl/speckit/neverplayed/public/realms/data/governance/surrogates.yaml) reifying the `person` and `maskot` (Senses: `Language`) surrogates.

### 4. Realm Declarations & dynamic Access Strategy
* **Habitat Manifest:** [habitat.json](file:///Users/ddoegl/speckit/neverplayed/public/realms/habitat.json)
  - Configure `seedData` block:
    ```json
    "seedData": {
        "beings": "./realms/data/habitat/beings.yaml",
        "surrogates": "./realms/data/habitat/surrogates.yaml"
    }
    ```
* **Governance Manifest:** [governance.json](file:///Users/ddoegl/speckit/neverplayed/public/realms/governance.json)
  - Add `"maskot"` to recognized surrogates: `"recognizedSurrogates": ["person", "maskot"]`.
  - Update `strategies` block to evaluate entry under an `OR` strategy matching either `person` or `maskot`:
    ```json
    "strategies": {
        "REALM_ACCESS:org.neverplayed.realm.governance": {
            "operator": "OR",
            "matchers": [
                { "type": "matchAttribute", "key": "surrogateId", "value": "person" },
                { "type": "matchAttribute", "key": "surrogateId", "value": "maskot" }
            ]
        }
    }
    ```
  - Configure `seedData` block:
    ```json
    "seedData": {
        "beings": "./realms/data/governance/beings.yaml",
        "surrogates": "./realms/data/governance/surrogates.yaml"
    }
    ```

### 5. Verification Plan & Test Runner Updates
* **File:** [ontology-harmony.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/ontology-harmony.test.ts)
  - Update any mock `fetch` intercepts to handle the new path structure (`realms/data/habitat/beings.yaml` and `realms/data/governance/beings.yaml`).
  - Run the test suite:
    ```bash
    deno task test --no-check
    ```
  - Ensure all 14 integration and regression tests return 100% green and stable.

---

## Relevant References & Memory Anchors
- **Ecosystem Constitution:** Section 10 in [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md) establishes the formal metaphysics.
- **Detailed Blueprint:** [implementation_plan.md](file:///Users/ddoegl/.gemini/antigravity/brain/39904400-ee76-4131-9a14-93d9200ee149/implementation_plan.md) contains exact technical diff specifications.
