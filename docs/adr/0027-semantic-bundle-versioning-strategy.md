# ADR 0027: Semantic Bundle Versioning Strategy

## Status

Accepted

## Context

NeverPlayed is a modular system where bundles are updated independently. Without
a strict versioning rule, it is difficult to determine the impact of a bundle
update on the rest of the system or whether a specific feature (like "Reactive
Variable Resolution") is available in a given environment.

## Decision

We adopt **Semantic Versioning 2.0.0** with specific interpretations for the
NeverPlayed Bundle Ecosystem:

### 1. Major Version (X.0.0) - "Breaking Changes"

Increment when a change is NOT backward-compatible with existing flows or other
bundles.

- **Service Breaking**: Changing a method signature in a core service (e.g.
  `UI_FACTORY_SERVICE`).
- **Schema Breaking**: Changes to `manifest.json` requirements or `uiSpec`
  parsing that would cause existing YAML files to fail.
- **Removal**: Removing a previously public component or utility.

### 2. Minor Version (x.Y.0) - "Functional Enhancements"

Increment when functionality is added or stabilized in a backward-compatible
manner.

- **Stabilization**: Moving a feature from "Regressed/Broken" to "Production
  Ready" (e.g., the recent `UIFactory` reactivity fix).
- **New Handlers**: Adding a new UI part handler (e.g., `chart` handler) that
  doesn't affect existing parts.
- **Performance**: Significant internal refactoring that improves system
  stability without changing APIs.

### 3. Patch Version (x.y.Z) - "Maintenance"

Increment for small, non-functional changes.

- **Documentation**: Updating `README.md` or adding JSDoc.
- **Bug Fixes**: Fixing a CSS layout issue or a typo in a log message.
- **Metadata**: Updating `Bundle-Category` or description in `manifest.json`.

## Rule: Documentation Alignment

A bundle's version MUST be bumped whenever its **Architecture & Implementation**
section in the `README.md` is updated to reflect structural changes.

## Consequences

### Positive

- **Predictability**: Operators can safely update bundles within the same Minor
  range.
- **Auditability**: `manifest.json` versions now serve as architectural
  checkpoints.

### Negative

- **Overhead**: Requires developers to actively assess the impact of their
  changes before committing.
