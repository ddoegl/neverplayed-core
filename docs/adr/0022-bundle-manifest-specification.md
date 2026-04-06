# 22. Bundle Manifest Specification

Date: 2026-04-06

## Status

Accepted

## Context

As the project scales, inconsistency in bundle metadata (`manifest.json`) leads to broken service discovery, misleading UI navigation, and difficult-to-maintain directory structures. A standardized metadata contract is required to ensure system-wide predictability.

## Decision

Officially adopt `docs/bundle-manifest-spec.md` as the mandatory **Gold Standard** for all bundle manifests in the NeverPlayed ecosystem.

1. **Naming**: Enforce a strict `org.neverplayed.<name>` symbolic naming convention.
2. **Directory Sync**: The bundle directory name must match its `Bundle-SymbolicName` exactly.
3. **Mandatory Fields**: All manifests must contain valid `Bundle-SymbolicName`, `Bundle-Name`, `Bundle-Version`, and `Bundle-Activator`.
4. **Automated Enforcement**: The `/lint-arch` workflow must be expanded to validate manifest compliance.

## Consequences

*   **Predictability**: Tools and orchestrators can rely on a consistent metadata schema.
*   **Ease of Discovery**: Standardized BSNs allow for cleaner service tracking and logging.
*   **Zero-Drift**: Automated linting prevents non-compliant bundles from entering the codebase.
