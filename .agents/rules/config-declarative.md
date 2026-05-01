## Configuration over Code

- **Declarative Preference**: Prefer declarative YAML-based definitions for domain objects and UI flows.
- **UI Factory**: Use the `ui-factory` to render standardized components from specs.
- **Schema Parsimony (Single Source of Truth)**: 
  - Always favor single-source-of-truth ordering via object keys (Lexical Key Ordering). 
  - **PROHIBIT** redundant "Shadow Sequences" (e.g., `stepOrder` arrays) that duplicate structure.
  - Blueprints must be lean; if an ordering can be derived from the map's key sequence, an external array is a violation.
