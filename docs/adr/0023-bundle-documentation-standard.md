# 23. Bundle Documentation Standard (Self-Documenting Architecture)

Date: 2026-04-06

## Status

Accepted

## Context

As the project scales into a "Bring Your Own Realm" (BYOR) ecosystem, it is critical that each bundle is self-documenting. ADRs provide high-level decisions, but the implementation details, current best practices, and "living patterns" of a specific bundle must be accessible within its own directory to prevent knowledge silos.

## Decision

Officially adopt `docs/bundle-readme-spec.md` as the mandatory standard for all bundle documentation.

1. **Mandatory README**: Every bundle in `public/bundles/` must contain a `README.md`.
2. **"The Patterns" Section**: Every bundle in the **Core Infrastructure** or **Semantic Foundation** realms MUST include a "The Patterns (The State)" section.
3. **Connectivity**: The Patterns section must link to the relevant ADRs that govern the bundle's implementation.
4. **Automated Enforcement**: The `/lint-arch` workflow must be expanded to validate the presence and structure of these README files.

## Consequences

*   **Self-Documentation**: Developers can understand a bundle's architecture without leaving its directory.
*   **Traceability**: Direct links between code implementation and architectural decisions.
*   **Zero-Gap Governance**: Automated linting ensures that documentation keeps pace with feature development.
