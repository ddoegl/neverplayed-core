# ADR 0026: Reactive Non-Destructive Variable Resolution

## Status

Accepted

## Context

The `UIFactory` and `PathResolver` previously used a "single-pass, destructive"
interpolation strategy. If a variable (e.g. `${name}`) was not immediately
available in the flow state, it was replaced with an empty string. This caused
two major architectural failures:

1. **Resolution Amnesia**: In multi-pass scenarios (like Action parameter
   resolution), a parameter that depended on another parameter (e.g. `endpoint`
   depending on `userId`) would have its marker erased in the first pass,
   preventing the second pass from ever resolving it once the dependency became
   available.
2. **Reactivity Gaps**: Late-hydrating data (e.g. from Firebase) arrives
   asynchronously. If the UI was rendered before the data arrived, the initial
   empty-string replacement was static, and the UI would not "wake up" or
   refresh when the data finally populated.

## Decision

We implement a three-tier "Reactive Non-Destructive" resolution strategy:

### 1. Non-Destructive Interpolation

`PathResolver.interpolate` is modified to return the original `${expr}` or
`{{expr}}` marker if no value is found. This preserves the template for
subsequent passes or late-binding resolution.

### 2. Reactive Magic Bridge

The Alpine.js magic helper `$uifResolve` is re-engineered to explicitly access
the reactive `uifValues` proxy within the component state. This creates a
reactive dependency: Alpine now "listens" for changes to the underlying state
and automatically re-evaluates all variable-dependent text blocks when data
arrives.

### 3. Manual Alpine Lifecycle (`initTree`)

For content injected via `innerHTML` (such as Markdown text parts or Card
labels), the system must explicitly call `Alpine.initTree(element)` after
injection. This ensures that Alpine discovers and "warms up" the reactive
`x-text` spans even if they were added after the initial component
initialization.

## Consequences

### Positive

- **Param Autowiring**: Action parameters can now safely depend on each other
  regardless of definition order.
- **Asynchronous UX**: The UI "follows the data"—placeholders update
  automatically as soon as Firebase or user inputs populate the state.
- **Developer Visibility**: Typos in variable names are now visible as
  `${missing}` markers in the UI during development, rather than mysteriously
  empty spaces.

### Negative

- **Marker Leakage**: If a variable is permanently missing, the `${marker}` will
  remain visible in the UI. (Note: This is considered a feature for faster
  debugging in this architecture).
