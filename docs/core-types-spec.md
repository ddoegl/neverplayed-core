# Gold Standard: Core Types & Constants Specification

This document defines the naming conventions for all global identifiers in the NeverPlayed ecosystem to ensure consistency, predictability, and avoid collisions.

## 1. PIDs (Configuration IDs)
Used for identifying persistent configuration in `ConfigAdmin`.

- **Convention**: `org.neverplayed.<subsystem>.<component>` (Lowercase, dot-separated).
- **Correct**: `org.neverplayed.shell.cli`, `org.neverplayed.auth.shield`
- **Incorrect**: `org.neverplayed.shell-cli`, `shell-config`

## 2. Service Interfaces
Used as `objectClass` in service registration and tracking.

- **Convention**: `org.neverplayed.<domain>.<Interface>` (CamelCase for the interface portion).
- **Correct**: `org.neverplayed.realm.RealmManager`, `org.neverplayed.shell.ShellHost`
- **Incorrect**: `org.neverplayed.realm-manager/service`, `@neverplayed/LogService`

## 3. Event Topics
Used in `EventAdmin` broadcasts and DOM-harmonized events.

- **Convention**: `org/neverplayed/<domain>/<ACTION>` (Slash-separated, lowercase domain, uppercase action).
- **Correct**: `org/neverplayed/realm/CHANGED`, `org/neverplayed/config/UPDATED`
- **Incorrect**: `neverplayed/realm/CHANGED`, `core/shell/toggle`

## 4. Service Properties
Used for filtering in `LDAP` trackers.

- **Convention**: `<domain>.<property>` (Lowercase, dot-separated).
- **Correct**: `flow.id`, `realm.title`, `user.alias`, `sidebar` (boolean)
- **Incorrect**: `flow_id`, `REALM-ID`

## 5. CSS / DOM Selectors
Used for mount points and scoping.

- **Convention**: `kebab-case` with optional `neverplayed-` prefix for core ID's.
- **Correct**: `shell-header`, `flow-active-stage`, `neverplayed-app-root`

## 6. Implementation Rule
All new constants MUST be exported from `public/core-types.js` using the upper-snake-case alias:
`export const REALM_MANAGER_SERVICE = "org.neverplayed.realm.RealmManager";`
