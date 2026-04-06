# 1. Centralized Architectural Constants

Date: 2026-04-06

## Status

Superseded by [0013-layered-architectural-constants.md](file:///Users/ddoegl/speckit/neverplayed/docs/adr/0013-layered-architectural-constants.md)

## Context

The project used a highly decoupled OSGi architecture where bundles interact via services and events. 
Hardcoding service interfaces, configuration PIDs, and event topics across multiple bundles (Magic Strings) 
leads to fragmentation and runtime null pointer exceptions.

## Decision (Legacy)

All OSGi service interfaces, configuration PIDs, and global Event Topics must be centralized in `public/shared-types.js`.

1. **Registration**: Services must be registered using constants from this file.
2. **Consumption**: Consumers must use the same constants for service lookups and LDAP filters.
3. **Alpine Injections**: When injecting service names into Alpine.js templates, template literals referencing these constants are required.

## Consequences

*   **Refactor Safety**: Updating a service ID in one place propagates through the system.
*   **Discovery Integrity**: Eliminates subtle typos that break service trackers or event listeners.
*   **Dependency**: All bundles now have a soft dependency on the shared types registry.
