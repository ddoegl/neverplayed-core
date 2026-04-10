# ADR-0032: Lexical Key Ordering Standard 🛡️🏛️

## Status
Accepted

## Context
Originally, the platform used a dual-source model for step sequencing: a `steps` map for content and a `stepOrder` array for sequence authority. However, as the Visual Editor evolved to support in-place reordering of object keys, the `stepOrder` array became a redundant "Shadow Sequence" that frequently drifted from the actual key order.

## Decision
We will formally adopt **Lexical Key Ordering** as the platform's Standard for all mapping objects that require sequencing (e.g., UI Steps, UI Parts).

1. **Single Source of Truth (SPOT)**: The order of keys in the object (e.g., `ui.steps`) is the definitive authority on visual and logical sequence.
2. **Deprecation of stepOrder**: The `stepOrder` array is deprecated and must be removed from all specifications and codebase iterators.
3. **Insertion Order Stability**: We rely on the stable key-insertion order guaranteed by modern JavaScript engines for string keys.

## Consequences
- **Spec Parsimony**: Blueprints are leaner and easier to maintain without redundant sequence arrays.
- **WYSIWYG Consistency**: The Visual Editor's in-place reordering is now the direct authority on YAML persistence.
- **Hydration Safety**: Eliminates the risk of "Order Drift" between the map and the array during OSGi service hydration.
