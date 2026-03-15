# Ideation: Harmonized "Configuration over Code" Model

## 1. Introduction & Vision

Currently, the system uses two distinct paradigms that conceptually overlap:

1. **Strategy Pattern** for `campaigns` and `topics`.
2. **Configuration Approach** for `rules`, `capabilities`, and `permissions`.

This document proposes a unified architecture that harmonizes these approaches
into a _cascading, hierarchical set of configurations_. By treating rules and
triggers as base strategies, we can build an evaluation pipeline that cascades
from low-level rules up to high-level domain sets, evaluating against a dynamic
context (e.g., `currentUser`, ownership properties, ingressing context).

---

## 2. The Proposed Hierarchical Model

The unified model groups configurations into layers. Each layer builds upon the
layer below it, effectively becoming a parameterized "strategy" in a larger
domain.

### Layer 1: Rule Primitives (The Atomic Matchers)

These are the atomic matching blocks of the configuration. They encapsulate a
single piece of "When" logic.

- **Examples:** `matchAlways`, `matchFeature(ID)`, `matchRole(ID)`,
  `matchProperty(KEY, VAL)`.
- **Concept:** These are pure predicates (Match/Skip).

### Layer 2: Domain Strategies (Composite Terms)

These define the "What"—the business outcomes. They organize Layer 1 primitives
into **Composite Matchers** (or Terms).

- **Unified Schema:**
  ```yaml
  id: STRATEGY_ID
  operator: AND # Logical combination of matchers
  matchers:
    - type: matchRole
      value: LEGALREPS
    - type: matchProperty
      key: customerId
      value: bikevalue
  ```
- **Concept:** A Strategy is no longer tied to one primitive. It can build
  complex logical terms to precisely segment users.
- **Harmonized UI:** All Domain Strategies use a **Master/Detail workspace**
  pattern.
  - **Sidebar (Directory):** Navigator for all defined strategies in the domain.
  - **Detail view:** Composable editor for build matcher terms and assigning
    outcomes.

### Layer 3: Domain Sets (The Configured Entities)

These are static, configuration-driven blueprints that map directly to business
structures and utilize Layer 2 strategies for activation.

- **Examples:** `topics`, `campaigns`, `capabilities-assignments`.
- **Concept:** Entities (like a Topic or a Capability Assignment) _attach_ to
  one or more Strategies. If the strategy matchers evaluate successfully, the
  entity is activated.

### Layer 4: Organizational Business Functions (Personas / Roles)

These define the organizational roles or personas that a user can assume. They
group users and map external roles to internal system features.

- **Examples:** `LEGALREPS` (Legal Representatives), `ADMINISTRATOR` (System
  Administrator), `CARDADMINISTRATION`.
- **Concept:** While Rule Strategies evaluate context, Business Functions often
  _provide_ crucial parts of that context (e.g., "The current user is acting as
  a LEGALREP"). They act as the highest-level aggregators that tie a user's
  organizational identity to the downstream capabilities, rules, and topics.

### Layer 5: Post-Pipeline Enrichment (Customization)

Once the cascade is evaluated and a base set of permissions/capabilities is
produced, an additional enrichment step applies user-specific customizations.

- **Examples:** `PERMISSIONBUNDLES` defined in `licenses.yaml`.
- **Concept:** Direct, granular assignments that sit on top of the generic
  cascade. They allow for overriding or additive permissions assigned
  specifically via a user's license.

### Layer 6: Configurable Primitives (The Atomic Factory)

To achieve true "Zero-Code" extensibility, even the Rule Primitives in Layer 1
can be configurable. This allows the system to support new matching logic
without engine re-deployments.

- **Declarative Primitives**: Simple comparison logic defined in YAML templates.
  - _Example_: `matchProperty` defined as `${context[it.key]} === it.value`.
- **Scripted Primitives**: Logic defined via sandboxed JavaScript snippets or
  expression languages (like Alpine.js expressions).
- **Service-Registered Primitives**: Allowing external OSGi bundles to register
  new Primitives via the Service Registry, which the engine then dynamically
  picks up.

- **Primitive Activation & Deactivation**: The environment or global
  configuration can selectively disable specific primitives. If a primitive is
  deactivated, any rule block utilizing it is automatically treated as `SKIP`.
  - _Scenario_: Disabling `matchFeature` in a "Retail" environment to prevent
    legacy business feature logic from executing.

---

## 3. Evaluation Engine: Pipeline or Visitor?

To evaluate this cascade dynamically against the `currentUser` and ingress
properties, we need a robust evaluation pattern.

### The Context Object

All evaluations depend on an injected context:

```typescript
interface EvaluationContext {
  currentUser: User;
  ingressingProperties: OwnershipData | RequestData;
  environment: EnvFlags;
}
```

### Option A: The Pipeline Pattern (Recommended)

Configurations act as middleware. The context passes through the pipeline.

1. **Passes through Rule Strategies**: Filters out invalid states immediately.
2. **Passes through Domain Strategies**: Computes weights, scopes, or
   capabilities.
3. **Resolves Domain Sets**: The pipeline outputs the finalized `Topic`,
   `Campaign`, or `PermissionSet`.

### Option B: The Visitor Pattern

A `ContextVisitor` traverses the configuration tree (Sets -> Domain Strategies
-> Rule Strategies).

- **Pros:** Excellent for deeply nested, composite configurations where
  different nodes require different evaluation logic.
- **Cons:** Harder to read and manipulate dynamically than a linear or chained
  pipeline.

---

## 4. Pros and Cons of a "One Pattern for All" Approach

### Pros

1. **Ultimate Consistency:** Developers only have to learn one mental model
   (`Strategy` -> `Set` -> `Evaluation`). Adding a new domain (e.g.,
   `PromotionStrategies`) follows the exact same pattern as `Topics`.
2. **Centralized Context Management:** Passing `currentUser` and ownership data
   is unified. No more figuring out _how_ to inject user context into different
   sub-systems.
3. **High Extensibility:** Rule strategies are highly reusable. A
   `TimeBoundStrategy` written for a Campaign can be instantly reused for a
   Capability.
4. **Enhanced Testability:** Strategies can be unit-tested in isolation by just
   mocking the `EvaluationContext`.
5. **Configuration over Code (Zero-Code Ready):** The hierarchical model maps
   perfectly to JSON/YAML. Business users can orchestrate rules, link them to
   domain strategies, and assign them to sets without writing code.

### Cons

1. **Over-engineering for Simple Cases:** Sometimes a feature flag is just a
   boolean. Forcing it through a `RuleStrategy` -> `DomainStrategy` ->
   `DomainSet` cascade introduces unnecessary boilerplates.
2. **Performance Overhead:** A polymorphic pipeline or deep visitor traversal is
   more CPU and memory intensive than direct `if/else` configuration checks.
   **Solution: The Compilation Phase.** To mitigate this, the architecture will
   employ a two-phase lifecycle:
   - **Configuration Phase:** Business users define rules in YAML. The system
     evaluates these dynamically (like a REPL) for testing and immediate
     feedback.
   - **Implementation (Compilation) Phase:** The system automatically derives
     and compiles the layered strategies into highly optimized, direct `if/else`
     JavaScript functions (e.g., generating evaluation code at bootstrap or when
     configurations change). This provides the performance of raw script checks
     with the manageability of zero-code YAML.
3. **Debugging Complexity:** When a user is denied access to a capability or
   campaign, tracing the failure through abstract layers ("Which strategy in the
   cascade failed?") is much harder than reading a procedural script. Strong
   logging/tracing mechanisms inside the evaluator pipeline are strictly
   required. **Leveraging the OSGi Logging Service combined with ConfigAdmin**
   will allow us to dynamically control log levels (e.g., turning on `TRACE` for
   specific pipelines without a redeployment) to inspect exactly which strategy
   in the cascade failed.
4. **Migration Effort:** As noted, moving from the current dual-setup to this
   unified model requires a major refactoring of core access and trigger logic.

---

## 5. Next Steps / Conclusion

Before building this, it is recommended to:

1. Map out the existing `rules.yaml` / `features.yaml` against a draft of this
   schema.
2. Build a minimal proof-of-concept (PoC) of the `EvaluationContext` pipeline
   for just _one_ domain (e.g., `capabilities`).
3. Benchmark the PoC against the current direct configuration approach to
   measure performance overhead.
