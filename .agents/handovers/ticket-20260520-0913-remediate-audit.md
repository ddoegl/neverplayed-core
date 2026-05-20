# Handover Ticket: Remediate Forensic Audit Report Violations

- **From:** Forensic Analyst
- **To:** Development Engineer
- **Context:** An interoceptive scan of the workspace has revealed architectural drift and inconsistencies between our runtime service registrations, configuration manifests, and code conventions across several bundles, particularly in the recently modified stratum and layout components, and the person-registry bundle.

## Objectives
You must resolve the following deviations to restore architectural compliance:

### 1. Align Manifest Capabilities (ADR-0022)
Ensure that all services registered in code are advertised under `Provide-Capability` in their respective `manifest.json` files:
- [ ] **`org.neverplayed.stratum-core`**: Add `@pandino/event-admin/EventHandler` to its capabilities in [manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/manifest.json).
- [ ] **`org.neverplayed.shell-sidebar`**: Add `@pandino/event-admin/EventHandler` to its capabilities in [manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-sidebar/manifest.json).
- [ ] **`org.neverplayed.shell-header`**: Add `@pandino/event-admin/EventHandler` to its capabilities in [manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/manifest.json).
- [ ] **`org.neverplayed.person-registry`**: Add the following service objectClasses to its capabilities in [manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.person-registry/manifest.json):
  - `org.neverplayed.infrastructure/persons/data`
  - `org.neverplayed.TransitionParticipant`
  - `org.neverplayed.flow.FlowService`
  - `org.neverplayed.plexus.KnowledgeProviderService`

### 2. Remediate Identifier Drift & Magic Strings
- [ ] **`org.neverplayed.person-registry`**: Replace the magic string `'org.neverplayed.realm.governance'` at line 159 of [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.person-registry/activator.js) with the centralized constant `REALM_GOVERNANCE` imported from `core-types`.

### 3. Establish Documentation & Testing Parity (ADR-0023, ADR-0028)
- [ ] **`org.neverplayed.stratum-core-dom`**:
  - Create a standard compliant `README.md` with links to `platform-patterns.md` and required ADR references.
  - Create a `tests/` directory with a smoke/regression test verifying its initialization and Alpine adapter behavior.
- [ ] **`org.neverplayed.person-registry`**:
  - Create a `tests/` directory with regression tests covering its user session enrichment and knowledge provider senses injection.

## Relevant Files
- [org.neverplayed.stratum-core/manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/manifest.json)
- [org.neverplayed.shell-sidebar/manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-sidebar/manifest.json)
- [org.neverplayed.shell-header/manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/manifest.json)
- [org.neverplayed.person-registry/manifest.json](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.person-registry/manifest.json)
- [org.neverplayed.person-registry/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.person-registry/activator.js)
- [telemetry/audit_report.txt](file:///Users/ddoegl/speckit/neverplayed/telemetry/audit_report.txt)
