# Handover Ticket: Minor Cleanup (Magic Strings & README)

- **From:** Forensic Analyst
- **To:** Development Engineer
- **Status:** ✅ Closed — Implemented 2026-05-21

- **Context:** Following the successful remediation merge, a few residual minor linter issues remain in `org.neverplayed.shell-header` and `org.neverplayed.stratum-core`.

## Objectives
- [x] **`org.neverplayed.shell-header`**:
  - Replace the magic string `"@pandino/event-admin/EventHandler"` at line 61 of [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/activator.js) with the `EVENT_HANDLER_INTERFACE` constant imported from `core-types`.
- [x] **`org.neverplayed.stratum-core`**:
  - Add the mandatory link to `platform-patterns.md` in its `README.md` (to satisfy ADR-0023).
  - Clean up the magic string check `segments[0]?.startsWith('org.neverplayed.realm')` at line 153 of [activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) using the `NEVERPLAYED_PREFIX` or a domain prefix constant if possible.

## Relevant Files
- [org.neverplayed.shell-header/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.shell-header/activator.js)
- [org.neverplayed.stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js)
- [org.neverplayed.stratum-core/README.md](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/README.md)
- [telemetry/audit_report.txt](file:///Users/ddoegl/speckit/neverplayed/telemetry/audit_report.txt)
