# Handover Ticket: Visceral Lobby Boot & Platform-Provisioned Infrastructure

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** We have aligned the ontology to establish that the Platonic Staging Lobby layout and diagnostic utilities are visceral platform infrastructure rather than dynamic realm content. To ensure a flawless boot even when zero spatial realms are registered (`realms/index.json` is empty), we must refactor the boot orchestration script in `realms-secure.html` to install and start all core, shell, and lobby utility bundles natively upon page hydration.

---

## Objectives

You must implement the following boot orchestration updates:

### 1. Refactor Boot Orchestration Loop
- [ ] In `public/realms-secure.html` ([public/realms-secure.html](file:///Users/ddoegl/speckit/neverplayed/public/realms-secure.html)), replace the old bundle installation script with the compact, sequential boot loop pattern demonstrated in [barebones-secure.html](file:///Users/ddoegl/speckit/neverplayed/public/barebones-secure.html).
- [ ] Load the complete list of core platform infrastructure, shell layout, and primordial diagnostic utility manifests in this exact dependency order:
  1. **Core Platform:**
     * `https://unpkg.com/@pandino/event-admin@0.8.33/dist/@pandino/event-admin-manifest.json` (Event Admin)
     * `./bundles/org.neverplayed.system-logger/manifest.json` (System Logger)
     * `./bundles/org.neverplayed.yaml-service/manifest.json` (YAML Service Base)
     * `./bundles/org.neverplayed.alpine-bridge/manifest.json` (Alpine Bridge)
  2. **Strategic Persistence Stratum:**
     * `./bundles/org.neverplayed.persistence-localstorage/manifest.json` (LocalStorage Persistence)
     * `./bundles/org.neverplayed.persistence-resolver/manifest.json` (Persistence Resolver)
     * `./bundles/org.neverplayed.persistence-selector/manifest.json` (Persistence Selector)
  3. **Session & Security:**
     * `./bundles/org.neverplayed.session-service/manifest.json` (Session Service)
     * `./bundles/org.neverplayed.session-service-dom/manifest.json` (Session Service DOM Extender)
     * `./bundles/org.neverplayed.auth-shield/manifest.json` (Auth Shield Layer 1)
  4. **Universe Managers:**
     * `./bundles/org.neverplayed.realm-manager/manifest.json` (Realm Manager Core)
     * `./bundles/org.neverplayed.realm-manager-dom/manifest.json` (Realm Manager DOM Extender)
     * `./bundles/org.neverplayed.perceiver-service/manifest.json` (Perceiver Sensation Service)
     * `./bundles/org.neverplayed.being-service/manifest.json` (Being Service)
  5. **Strata & Senses:**
     * `./bundles/org.neverplayed.stratum-core/manifest.json` (Stratum Core)
     * `./bundles/org.neverplayed.stratum-core-dom/manifest.json` (Stratum Core DOM Extender)
     * `./bundles/org.neverplayed.stratum-cli/manifest.json` (Stratum CLI)
     * `./bundles/org.neverplayed.stratum-hud/manifest.json` (Stratum HUD)
  6. **Diagnostic Lobby Utilities:**
     * `./bundles/org.neverplayed.stratographer/manifest.json` (The Stratographer Sensation Flow)
  7. **Core Shell & Layout:**
     * `./bundles/org.neverplayed.shared-ui/manifest.json` (Shared UI Elements)
     * `./bundles/org.neverplayed.shell-host/manifest.json` (Shell Host Layout)
     * `./bundles/org.neverplayed.shell-header/manifest.json` (Shell Header)
     * `./bundles/org.neverplayed.shell-sidebar/manifest.json` (Shell Sidebar)
  8. **Shell CLI & Tools:**
     * `./bundles/org.neverplayed.shell-cli/manifest.json` (Shell CLI Component)
     * `./bundles/org.neverplayed.shell-cli-ext/manifest.json` (Shell CLI Extensions)
     * `./bundles/org.neverplayed.shell-cli-dom/manifest.json` (Shell CLI DOM Adapter)
     * `./bundles/org.neverplayed.system-reset/manifest.json` (System Reset)
     * `./bundles/org.neverplayed.config-admin/manifest.json` (Config Admin)
     * `./bundles/org.neverplayed.event-monitor/manifest.json` (Event Monitor)
     * `./bundles/org.neverplayed.alpine-inspector/manifest.json` (Alpine Inspector)
  9. **Plexus Sensation Engine:**
     * `./bundles/org.neverplayed.plexus-core/manifest.json` (Plexus Core)
     * `./bundles/org.neverplayed.plexus-enricher/manifest.json` (Plexus Enricher)
     * `./bundles/org.neverplayed.plexus/manifest.json` (Plexus Context Engine)
     * `./bundles/org.neverplayed.plexus-sensor/manifest.json` (Plexus Sensor)
     * `./bundles/org.neverplayed.plexus-tracing/manifest.json` (Plexus Tracing)
     * `./bundles/org.neverplayed.plexus-test/manifest.json` (Plexus Test Utility)

### 2. Verify Zero-Realm Boot Stability
- [ ] Test the page locally with `realms/index.json` cleared to `[]`.
- [ ] Confirm that:
  - The shell boots cleanly without any errors.
  - You are authenticated in the Platonic Lobby with the `observer` surrogate.
  - The Stratographer boots automatically as the default workspace view.
  - The sidebar correctly renders the four lobby diagnostic flows (stratographer, event-monitor, cli, config-admin).
- [ ] Ensure that all regression and integration tests in the test suite run successfully:
  ```bash
  deno task test --no-check
  ```

---

## Relevant Files
- [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md)
- [public/realms-secure.html](file:///Users/ddoegl/speckit/neverplayed/public/realms-secure.html)
- [public/barebones-secure.html](file:///Users/ddoegl/speckit/neverplayed/public/barebones-secure.html)
