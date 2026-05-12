## Architectural Consistency & OSGi Patterns

- **ADR Authority**: Before every task, the agent MUST scan `docs/adr/` to align with established decisions.
- **Compliance**: All code generation must strictly adhere to 'Accepted' ADRs.
- **Pattern Adherence**: Always check `docs/architecture-patterns.md` when implementing new functionality. Adhere to established reactive and OSGi patterns.
- **Master Cockpit**: `org.neverplayed.stratum-explorer` is the definitive forensic Master Cockpit for the Areal Network. All other UIs (like `stratographer`) are auxiliary HUDs or legacy views.
- **Legacy Components**: `public/index.html` and `public/shared-types.js` are DEPRECATED. The active entry point is `public/realms-secure.html` and the source of truth for types is `public/core-types.js`.
- **No Magic Strings**: All service identifiers must be centralized in `public/core-types.js`.
- **Canonical Identity Standards**: 
  - `public/realms-secure.html` is the only valid entry point for the Secure Realm.
  - `public/core-types.js` is the single source of truth for all service and PID identifiers.
- **Decoupling and Discovery**: Use lazy, on-demand service retrieval to handle OSGi race conditions.
