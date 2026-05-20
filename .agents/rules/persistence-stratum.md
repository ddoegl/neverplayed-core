## Persistence & Stratum Authority

- **Stratum Authority (Contextual Awareness)**: 
  - `STRATUM_SERVICE` is the single source of truth for the system's multidimensional state (WHO, WHERE, WHAT, HOW).
- **Headless Stratum Decoupling (ADR-0176)**:
  - Core stratum services MUST remain completely headless, environment-agnostic, and free of Alpine.js imports. They must publish changes via OSGi `EventAdmin` (topic: `org/neverplayed/stratum/CHANGED`), delegating DOM and Alpine store synchronization to dedicated UI adapters.
- **Cross-Identity Parameterized Routing (ADR-0177)**:
  - Persistence queries targeting specific profiles MUST use the `options.identityId` override to route read/write namespace paths correctly, preventing observer identities from writing records into their own local namespaces.
- **Forensic Traceability**: 
  - All logging, persistence, and audit operations MUST utilize the `toURI()` method or the core facets provided by this service.
- **Navigational Sovereignty**: 
  - Aim for full navigational sovereignty through linkable context URIs.
