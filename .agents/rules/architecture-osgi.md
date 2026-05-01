## Architectural Consistency & OSGi Patterns

- **ADR Authority**: Before every task, the agent MUST scan `docs/adr/` to align with established decisions.
- **Compliance**: All code generation must strictly adhere to 'Accepted' ADRs.
- **Pattern Adherence**: Always check `docs/architecture-patterns.md` when implementing new functionality. Adhere to established reactive and OSGi patterns.
- **Master Cockpit**: `org.neverplayed.stratographer` is the definitive forensic resident for the Flow Stage. Native HUDs and legacy sidebars are retired in favor of this integrated dashboard.
- **No Magic Strings**: All service identifiers must be centralized in `public/core-types.js`.
- **Canonical Identity Standards**: 
  - `public/realms-secure.html` is the only valid entry point for the Secure Realm.
  - `public/core-types.js` is the single source of truth for all service and PID identifiers.
  - Centralize all service IDs and flow identifiers in `osgi/shared-types.js`.
- **Decoupling and Discovery**: Use lazy, on-demand service retrieval to handle OSGi race conditions.
