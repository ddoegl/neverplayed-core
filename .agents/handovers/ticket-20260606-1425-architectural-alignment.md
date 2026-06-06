# Handover Ticket: Architectural Governance & ADR Alignment

**Ticket ID:** TICKET-20260606-1425-ARCHITECTURAL-ALIGNMENT  
**From:** Forensic Analyst  
**To:** Development Engineer  
**Status:** OPEN  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Context & Architectural Drift

An interoceptive scan of the workspace has revealed substantial deviations (architectural drift) from our established Architecture Decision Records (ADRs). The Deno linter script reports violations across Core, Foundation, and Domain layers.

The primary drift issues fall into three categories:
1. **Implicit Service Registration (Violation of ADR-0022):** Several bundles register services programmatically in their `activator.js` but fail to advertise them in their `manifest.json` under the `"services.provides"` declaration.
2. **Missing Mandated Documentation and Folders (Violation of ADR-0023 and ADR-0028):** Multi-phase bundles are missing standard-compliant `README.md` files, JSDoc headers, and mandatory `tests/` directories.
3. **Magic String Pollution:** Activators and template files reference system constants, service names, and configuration PIDs as raw string literals rather than importing them from the central `public/core-types.js` repository.

Detailed telemetry reports can be found in `/telemetry/audit_report.txt`.

---

## 2. Technical Cleanup Objectives

### Objective 1: Sync manifest.json Declarations (ADR-0022)
Ensure that every bundle registering a service in `activator.js` also lists that service symbolic name in its `manifest.json`.
* **Action:** Iterate through all bundles flagged in `/telemetry/audit_report.txt` and populate their `manifest.json` `"services.provides"` array with the correct symbolic class names (e.g. `org.neverplayed.plexus.Sensor`, `org.neverplayed.persistence.Resolver`, `org.neverplayed.LogService`, etc.).

### Objective 2: Recover Missing Documentation and Test Infrastructures (ADR-0023 / ADR-0028)
* **Action:** 
  1. Scaffold boilerplate `README.md` files for all bundles flagged as missing them.
  2. Add standardized JSDoc header documentation to the top of all flagged `activator.js` files.
  3. Create a default `tests/` folder in each flagged bundle to satisfy the linter's structural layout audit.

### Objective 3: Replace Magic Strings with Public Core Types
* **Action:** Clean up raw string references inside activators and templates. Import the centralized constants from `public/core-types.js` (or use namespaced constant keys) for:
  - Service names (e.g., `PERCEIVER_SERVICE`, `STRATUM_SERVICE`, `EVENT_ADMIN_SERVICE`)
  - Configuration PIDs (e.g., `SYSTEM_LOGGER_PID`)
  - Target system realms and flow identifiers

---

## 3. Verification Plan

Run the Cascading Layer Linters to ensure all checks return clean (green):
```bash
deno task lint:arch:core
deno task lint:arch:foundation
deno task lint:arch:domain
```
Additionally, run the full integration suite to ensure no regressions were introduced by renaming imports:
```bash
deno task test
```
