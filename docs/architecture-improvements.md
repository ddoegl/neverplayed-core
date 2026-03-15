# Architecture Improvements Backlog

This document tracks planned architectural refactorings, technical debt
reduction, and system standardization efforts for the platform.

## 1. Entity ID Standardization and Prefixing

**Context:** Currently, entities in various registries (Persons, Users, Tenants,
Companies) often share similar or identical string IDs (e.g., `july` can refer
to a Person object, a User on a License, or a Fellow). This creates ambiguity
within the evaluation engine and UI tools when cross-referencing objects.

**Proposed Solution:** Introduce a strict, type-safe ID prefixing convention
across the system:

- Persons: `p-[id]` (e.g., `p-july`, `p-rob`)
- Users: `u-[id]` (e.g., `u-robby`, `u-sc-admin`)
- Tenants: `t-[id]`
- Companies / Customers: `c-[id]` (e.g., `c-bikevalue`)
- Cases: `case-[id]`

**Migration Considerations:** Because these IDs act as foreign keys,
implementing this change requires a synchronized, system-wide data migration.
The following files and structures will need updating to maintain referential
integrity:

- `persons.yaml` (Primary Key: `id`, Foreign Keys: `authorizations.company`)
- `licenses.yaml` (Foreign Keys: `owner`, `holder`, `licenseholder`,
  `customers`, `USERS[].id`)
- `fellows.yaml` (Foreign Keys: `personId`, `customerId`, `fellowOf`)
- `cases.yaml` (Foreign Keys: `metadata.targetPersonId`, `metadata.companyId`,
  `signatures[].personId`)
- Global Evaluation Engine (`backoffice-evaluation/activator.js`) which parses
  and matches these keys.

_Status: Backlogged for a future refactoring sprint._

## 2. Centralized OSGi Logging Transformation

**Context:** Currently, the codebase relies heavily on native `console.log`,
`console.warn`, and `console.error` calls scattered across various activators
and controllers for debugging.

**Proposed Solution:** Transition all standard output streams to utilize the
native OSGi logger service built into the Pandino framework.

**Benefits:**

- **Standardization:** All logs will follow a predictable format and severity
  level instead of ad-hoc strings.
- **Routing:** Logs can be properly routed, filtered, or piped to external
  aggregation services or dedicated developer UI consoles.
- **Performance:** Production environments can easily suppress trace-level
  logging globally without manually stripping `console.log` statements.

**Implementation Plan:**

1. Track the Pandino Logger Service within the `start(context)` method of each
   bundle activator.
2. Replace local `console.*` calls with corresponding OSGi logger invocations.
3. Ensure the core Shell/Host exposes the compiled log streams cleanly to
   developers.

_Status: Backlogged for a future refactoring sprint._

## 3. Standardize Bundle IDs and Bundle-SymbolicName (BSN)

**Context:** As the platform has grown, the naming conventions for bundle
directories, `id` fields in `manifest.json`, and `Bundle-SymbolicName`
properties have diverged. This causes friction when tracking services and
debugging dependencies.

**Proposed Solution:** Establish and document a clear, uniform naming convention
for all bundles.

- Directory names should match the `id` and `Bundle-SymbolicName` exactly (or
  follow a strict mapping rule).
- Use a predictable prefixing or namespacing strategy (e.g.,
  `prototyper.flow.[name]`, `prototyper.service.[name]`).

**Implementation Plan:**

1. Audit all existing `manifest.json` files and directory structures.
2. Rename inconsistencies to tightly align the filesystem name with the logical
   OSGi bundle name.
3. Update any hardcoded references or `context.trackService` calls that rely on
   old names.

_Status: Backlogged for a future refactoring sprint._

## 4. Basic Activator Class Implementation

**Context:** Many OSGi bundle activators in the system copy-paste the same
boilerplate logic for tracking services (like YAML, Selection, EventAdmin),
managing reactive state (Alpine.js integration), loading templates, and
registering themselves into the framework.

**Proposed Solution:** Introduce a base or abstract `Activator` class that
encapsulates these repetitive patterns.

**Benefits:**

- **DRY (Don't Repeat Yourself):** Reduces boilerplate code significantly across
  all flow and service bundles.
- **Maintainability:** Fixes to core lifecycle patterns (like the recent Alpine
  double-evaluation bug) only need to be applied in one place.
- **Configurability:** Bundles can define their behavior via simple
  configuration objects passed to the base class, falling back to method
  overriding only for specific custom logic.

**Implementation Plan:**

1. Extract the common service-tracking and state-initialization logic from
   complex activators (e.g., `company-authorizations`, `dashboard`).
2. Create `BaseFlowActivator` and `BaseServiceActivator` classes.
3. Incrementally refactor existing bundles to `extend` these base classes rather
   than writing bespoke `start(context)` methods.

_Status: Backlogged for a future refactoring sprint._ 120: 121: ## 5. Surgical
Action Guarding with Limes 122: 123: **Context:** Current navigation guarding
via Limes operates at the "Entry Point" 124: level (visibility of the entire
bundle). Internal actions (buttons like 125: "Delete", "Grant", "Sync") still
rely on raw permission keys or are 126: ungated once an admin is inside the
flow. 127: 128: **Proposed Solution:** Expand the Limes strategy naming
convention to support 129: flow-specific actions. 130: 131: - Convention:
`FLOW_ACTION:[flow-id]:[action-id]` 132: - Example:
`FLOW_ACTION:user-management:delete-user` 133: 134: **Benefits:** 135: 136: -
**Fine-Grained Control**: Enable/disable specific buttons dynamically across
137: different environments or user personas. 138: - **Traceability**: Guarding
decisions for critical actions are traced in the 139: Limes logs, providing
better auditability. 140: 141: _Status: Planning phase for Limes v2._ 142: 143:
## 6. Session Desaturation (Capability Removal) 144: 145: **Context:** The
system currently "stains" user session objects by injecting 146: a `grantedKeys`
map and a large `capabilities` array during the login/recompile 147: phase. This
increases memory footprint and creates potential for data 148: inconsistencies
(Capability Staining). 149: 150: **Proposed Solution:** Pivot to a
"Just-in-Time" evaluation model where 151: bundles consult Limes instead of
checking local `user.grantedKeys`. 152: 153: **Implementation Plan:** 154:
155: 1. Transition all remaining `hasPermissions` calls to `limes.isAllowed`.
156: 2. Remove the `grantedKeys` injection logic from `backoffice-evaluator`.
157: 3. Use Limes to derive temporary "Capability Context" only when explicitly
158: needed for UI rendering (e.g. Permission Registry view). 159: 160: _Status:
Long-term goal enabled by Limes adoption._
