# 8. Focus-Preserving Reactive Rendering

Date: 2026-04-06

## Status

Accepted

## Context

Standard `innerHTML` updates used in Custom Element `render()` methods are destructive, causing input fields to lose focus and cursors to vanish when state changes occur.

## Decision

Adopt the **Focus Guard** pattern for reactive rendering:
1. **Idempotent Shell**: Set the main layout only once during initialization.
2. **Targeted Sub-updates**: Use `querySelector` to update specific text nodes or attributes without rebuilding the entire DOM tree.
3. **Contextual Regeneration**: Only rebuild sub-containers if the underlying context (e.g., ID) actually changed.

## Consequences

*   **Superior UX**: Eliminates focus loss in forms and editors.
*   **Performance**: Minimizes DOM parsing overhead for redundant updates.
*   **Implementation Overhead**: Requires more granular DOM manipulation logic compared to pure string templates.
