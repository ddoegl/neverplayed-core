# Harmonization PoC Specification: Capabilities Evaluation

## 1. Goal

Implement the `EvaluationContext` pipeline for the **Capabilities** domain to
prove the unified configuration paradigm. This PoC will evaluate which feature
keys a given user should have active, based on their assigned Business Function
and contextual properties.

## 2. Scope & Inputs

The PoC will use the following existing files as input configurations:

- `backoffice-rules/data/rules.yaml`
- `backoffice-capabilities/data/optional-features.yaml`
- `backoffice-business-functions/data/business-functions.yaml`
- `backoffice-licenses/data/licenses.yaml`

We will not yet refactor `topics`, `campaigns`, `sca`, or `signing`. Success is
measured by correctly producing a list of authorized capability keys for a given
user context (including permission bundles) using the new pipeline pattern.

---

## 3. Architecture Mapping for the PoC

### Layer 1: Rule Strategies

We will extract the logic currently embedded in permission scripts into
standalone strategies:

- `GlobalStrategy` (Always true)
- `WithFeatureStrategy` (Checks if context has a specific feature)
- `LicenseholderStrategy` (Checks environment/license)
- `WithRoleStrategy` (Checks the active Organizational Business Function)

### Layer 2: Domain Strategies ("Capability Strategy")

A strategy that takes a target capability (from Layer 3) and runs the Rule
Strategies (from Layer 1) to determine if it should be granted.

### Layer 3: Domain Sets

The models representing items from `optional-features.yaml` (e.g., the
`GUARANTEE` feature containing keys like `GUARANTEE_VIEW_INSTANCES`).

### Layer 4: Organizational Business Functions

The user's context, defined in `business-functions.yaml` (e.g., the user is
acting via `id: LEGALREPS`, with `type: legal-representative`).

### Layer 5: Post-Pipeline Enrichment

After evaluating the base cascade, the evaluator checks the user's
`permissionbundles` from `licenses.yaml`. The permissions contained within those
assigned bundles are appended to the final set of granted capabilities.

---

## 4. Implementation Details

### 4.1. The Pipeline Evaluator & Compiler

```typescript
interface EvaluationContext {
  userId: string;
  activeBusinessFunction: string; // e.g., 'LEGALREPS'
  environment: Record<string, any>;
}

// The two-phase engine
interface PipelineEngine {
  // Phase 1: Test & Dynamic Evaluation
  evaluateCapabilities(context: EvaluationContext): Set<string>;

  // Phase 2: Compilation
  // Derives the YAML cascade into an optimized, pure JavaScript function
  compileEvaluator(): (context: EvaluationContext) => Set<string>;
}
```

The PoC will demonstrate both dynamically interpreting the rules (Phase 1) and
invoking the compiled `if/else` function (Phase 2) to prove we can achieve zero
performance overhead.

### 4.2. Logging & Tracing

Debugging a dynamic pipeline requires granular visibility.

- **Component:** OSGi `LogService` via declarative services.
- **Configuration:** OSGi `ConfigAdmin`.
- **Behavior:** The pipeline will emit `TRACE` logs at each strategy evaluation
  step:
  - `"Evaluating RuleStrategy [WithRoleStrategy] for capability [GUARANTEE_VIEW_INSTANCES]: PASS"`
- By associating this with a specific Logger PID via `ConfigAdmin`, system
  administrators can turn down verbosity to `INFO` in production, but instantly
  enable `TRACE` for the pipeline without restarting the bundle when debugging
  access issues.

### 4.3. Code Generation (Compilation)

To mitigate the performance overhead of hierarchical evaluation, the engine will
act as a compiler:

- When the configuration bundles load, the engine parses the YAML.
- It generates a single, flat JavaScript function via string concatenation that
  contains pure `if (context.activeBusinessFunction === 'LEGALREPS') { ... }`
  checks.
- It creates the executable function (e.g., using `new Function()` or a
  dedicated build step module).
- At runtime, the compiled function executes instantaneously without traversing
  any JSON trees or invoking strategy classes.

## 5. Next Steps for Development

1. **Scaffold the API**: Create the `EvaluationContext` and `RuleStrategy`
   interfaces in a shared bundle (e.g., `system-services-api`).
2. **Implement Strategies**: Create the implementation classes for the 4 base
   rules in `rules.yaml`.
3. **Build the Engine**: Create the OSGi component that aggregates these
   strategies and provides both the dynamic `evaluateCapabilities` method and
   the `compileEvaluator` method.
4. **Wire Logging & Compilation**: Integrate `LogService` and demonstrate the
   generated fast-path function.
5. **Write Unit Tests**: Feed synthetic `EvaluationContexts` (e.g., simulating
   an `ADMINISTRATOR` vs a `LEGALREP`) and assert the generated keys match
   expected legacy output.
