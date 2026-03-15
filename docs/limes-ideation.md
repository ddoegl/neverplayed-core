# Limes: The Contextual Guarding Service 🍋⚖️🧬

## Overview

Limes is a "Guarding Service" that provides high-level binary decisions
(allowed/denied) by applying **Guard Strategies** to runtime **Context
Objects**. It sits atop **Plexus** and the **Backoffice Evaluator**, providing a
simplified API for bundles to enforce complex, context-aware business rules.

## Core Concepts

### 1. Guard Strategies

A Strategy is a set of rules (matchers) that defines "what makes an action
allowed." Strategies are registered by bundles and can be "shaped" via Plexus
configuration.

### 2. Context Objects

The "Target" of the evaluation. For a document-management bundle, the context
might be a `Case` object. For a UI bundle, it might be a `ButtonAction` object.

### 3. The Limes API

```javascript
interface LimesService {
    /**
     * @param userId The ID of the user
     * @param strategyId The ID of the guard strategy to apply (e.g., 'CASE_VISIBILITY')
     * @param context Optional object to match against (e.g., the Case object)
     */
    isAllowed(userId, strategyId, context?): boolean;
    
    /**
     * Registers a new strategy definition
     */
    registerStrategy(strategyId, definition): void;
}
```

## Strategy Examples

### A. Case Visibility Strategy (Aggregation)

Requires the user to have a specific permission AND for the user's customer
scope to overlap with the case's customers.

```yaml
id: CASE_VISIBILITY
operator: AND
matchers:
  - type: matchPermission
    value: DOCUMENTS_MANAGE_ALLOWED
  - type: matchScopeIntersection
    property: customers
```

### B. Cosmetic/UI Guard

Guarded only by a specific permission key for simple view/hide logic.

```yaml
id: UI_RESTRICTED_ACTION
matchers:
  - type: matchPermission
    value: PREVIEW_BETA_DASHBOARD_ALLOWED
```

## Logic Flow

1. **Strategy Lookup**: Find the registered `strategyId`.
2. **User Capability Retrieval**: Fetch the `evaluatedData` for the user from
   Plexus.
3. **Evaluation**:
   - For each matcher in the strategy:
     - If it's a `matchPermission`: Check if the user has the key.
     - If it's a `matchScopeIntersection`: Check if `context[property]` contains
       any IDs from the user's `customers` list for that permission.
     - If it's a `matchProperty`: Compare `context[key]` with the required
       value.
4. **Binary Result**: Return `true` only if the strategy's operator condition is
   met.

## Integration Example: Case Management

```javascript
// Case Mangement Activator
limes.registerStrategy("CASE_FULL_ACCESS", {
  operator: "AND",
  matchers: [
    { type: "matchPermission", value: "DOCUMENTS_MANAGE_ALLOWED" },
    { type: "matchScopeIntersection", property: "customers" },
  ],
});

// Inside the UI Loop
const isFullAccess = limes.isAllowed(user.id, "CASE_FULL_ACCESS", currentCase);
if (isFullAccess) {
  this.showFullDetails();
} else {
  this.showSummaryOnly();
}
```

## Governance & Management

Limes follows a "Merged Configuration" model to balance system stability with
bundle-specific flexibility.

### 1. The Strategy Lifecycle

- **Seed (Core)**: Limes bundle ships with `limes-strategies.yaml` containing
  system-wide defaults (e.g. `GLOBAL_VIEW`).
- **Dynamic (Bundles)**: Bundles register their specific strategies (e.g.
  `CASE_VISIBILITY`) during `start()`.
- **Persistent (Admin)**: All strategies are stored in
  `ConfigAdmin`/`PersistenceManager`. Admins can override any strategy (Core or
  Dynamic) via the UI.

### 2. Management UI

Limes provides a dedicated **Guard Management** view in the Backoffice:

- **Registry Overview**: List of all active strategies and which bundle
  registered them.
- **Visual Editor**: Uses the `YAML_EDITOR_SERVICE` to allow raw configuration
  editing of any strategy.
- **Traceability Console**: A "Test Guard" tool where Admins can pick a User +
  Strategy + Mock Context to see why access is granted or denied.

## Relationship with Plexus 🧠🔗🍋

Limes is not a replacement for Plexus, but a **specialized "Guarding Tier"**
that sits on top of Plexus output for surgical, resource-aware access control.

- **Plexus** determines what you _can_ do globally (The Identity Tier).
- **Limes** determines if you are allowed to perform a _specific action_ on a
  _specific resource_ (The Guarding Tier).

### The New Vocabulary

Limes introduces predicates that act as "macro-matchers" against the Plexus
capability AST:

- **`matchPermission`**: Checks the `grantedKeys` or `capabilities` AST already
  computed by Plexus.
- **`matchScopeIntersection`**: Checks if the user's permission scope (e.g.,
  specific customers) intersects with the resource context.

| Feature    | Plexus                             | Limes                                      |
| :--------- | :--------------------------------- | :----------------------------------------- |
| **Role**   | The "Big Brain" (Global Evaluator) | The "Surgical Shield" (Resource Guard)     |
| **Input**  | Licenses, Rules, Persona           | User Capabilities (AST) + Resource Context |
| **Output** | Capability Set (What you are)      | Binary `isAllowed` (Access Decision)       |

## Benefits

- **Consistency**: Centralizes "shaping" logic for complex data aggregations.
- **Pluggability**: Bundles can provide their own context strategies, which can
  then be "overridden" or "extended" via centralized YAML configuration.
- **Traceability**: Limes can log _why_ a specific context access was denied
  (e.g., "User has permission but wrong customer scope").
