# Gold Standard: Bundle Documentation Specification (README.md)

This document establishes the mandatory structure for `README.md` files within the NeverPlayed ecosystem, ensuring that every bundle is self-documenting and aligned with our architectural decisions (ADRs).

## 1. Mandatory Sections

Every bundle (especially infrastructural ones) must include:

### I. Bundle Overview
A brief description of what the bundle does, its primary responsibility, and its role in the ecosystem.

### II. 🏛️ Architecture & Implementation
- **Service Interfaces**: Which OSGi services it provides or consumes (linking to `core-types.js`).
- **State Management**: How it handles internal or global state (e.g., Alpine Stores, Persistence Tiers).

### III. 🧩 The Patterns (The State) - MANDATORY FOR CORE/FOUNDATION
This section connects the code to the project's "Living Wisdom". It should:
1. **Platform Alignment**: Explicitly state which [Platform Patterns](../../docs/platform-patterns.md) it implements (e.g., "Implements the Resilient Service Retrieval pattern for licensing connectivity").
2. **Architecture Compliance**: Provide direct links to relevant [ADRs](../../docs/adr/) that govern the bundle's implementation.
3. **Internal Best Practices**: Detail any bundle-specific patterns or "How to use this service" guides for other bundle developers.

### IV. 🚀 Future Road (Planned Refactorings)
Identify known technical debt, planned upgrades (e.g., "Upgrade to Monaco Editor"), and "Evolving Wisdom" targets.

## 2. Directory Placement
The `README.md` must reside at the root of the bundle directory, alongside `manifest.json`.

## 3. Mandatory for System Services
Bundles with `"Bundle-Category": "system-service"` or those residing in the **Core** and **Foundation** realms MUST adhere to this specification strictly. Failure to do so is considered **Architectural Documentation Drift**.
