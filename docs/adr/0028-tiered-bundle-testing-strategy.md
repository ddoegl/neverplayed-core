# ADR 0028: Tiered Bundle Testing Strategy

## Status

Accepted

## Context

Regressions in core logic (e.g., variable interpolation, reactive hydration)
have historically caused cascading failures across the Never Played platform. To
achieve "StableCore" status, we need a standardized testing requirement that is
integrated into our architectural governance.

## Decision

We implement a tiered testing model for all platform bundles, enforced via the
`lint-arch` linter:

### 1. Requirements by Layer

- **Core & Foundation**: MUST have a `tests/` directory containing unit tests
  for all business logic and service providers.
- **Domain**: SHOULD have integration tests for multi-step flows.

### 2. Test Tiers

- **Unit Tests (`deno test`)**: Pure logic verification (e.g., `PathResolver`,
  `StateHandlers`). Verified in isolation.
- **Bundle Integration**: Testing service tracks and handshakes within the OSGi
  context (using `test-harness.ts`).
- **Regression Guard**: Every critical bug fix MUST be accompanied by a unit
  test to prevent future regressions.

### 3. Reporting & Badging

- **Linter Enforcement**: `lint-arch` will now check for the existence of the
  `tests/` folder.
- **Quality Badge**: READMEs must display a Documentation Health badge that also
  reflects the testing status.

## Consequences

### Positive

- **High Confidence**: Automated verification of core platform primitives.
- **Self-Healing Documentation**: The linter ensures that new features aren't
  added without quality safeguards.
- **Faster Debugging**: Regressions are caught at commit time rather than
  runtime.

### Negative

- **Development Latency**: Requires extra time for test writing during the
  stabilization phase.
- **Environment Complexity**: Headless UI testing requires specialized harnesses
  (e.g. `JSDOM`).
