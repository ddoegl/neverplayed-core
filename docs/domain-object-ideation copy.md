# Domain Object (DO) Strategies & Governance

A Domain Object Strategy defines the **Shape** (Schema) and available
**Actions** for a domain entity.

## 1. DO Strategy (The Shape)

Strategies are defined in YAML and registered within the
`backoffice-do-registry`.

```yaml
# Example: Strategy for a Financial Product
DO_STRATEGY_PRODUCT:
  id: product-strategy
  label: Financial Product
  description: Defines the lifecycle of a tradable financial asset.
  properties:
    - name: color
      type: string
      label: Brand Color
    - name: class
      type: string
      label: Asset Class (Standard/Premium)
    - name: productId
      type: string
      label: Unique Internal ID
  actions:
    - id: view
      label: View Details
      icon: fas fa-eye
    - id: sign
      label: Authorize Product
      icon: fas fa-file-signature
    - id: trade
      label: Open Trade
      icon: fas fa-exchange-alt
```

## 2. Domain Object Registry (The Instances)

A Domain Object is a specific **instance** of a Strategy. These are persisted in
the `backoffice.do.registry` state.

```yaml
# Instance: Premium Blue Product
PRODUCT_ONE:
  id: product-1
  strategyId: DO_STRATEGY_PRODUCT
  label: Premium Euro Bond
  description: High-yield bond for premium clients.
  properties:
    color: blue
    class: premium
    productId: product-1
```

## 3. High-Granularity Guarding (ABAC)

We use **Attribute-Based Access Control (ABAC)** via Limes to guard specific DO
instances based on their properties.

### Step-by-Step Security Setup

1. **Define Permission Key**: `product:sign:allowed`
2. **Define Feature**: `PRODUCT_TRADING` (contains the permission key).
3. **Define Business Function**: `PRODUCT_SIGNEE` (a role assigned to users).
4. **Configure Capability Strategy**:
   ```yaml
   # Grant signing capability to Premium Product Signees
   PRODUCT_SIGNEE_CAPS:
     id: PRODUCT_SIGNEE_CAPS
     matchers:
       - type: matchRole
         value: PRODUCT_SIGNEE
       - type: matchProperty # ABAC Match
         key: class
         value: premium
     operator: AND
     features:
       - id: PRODUCT_TRADING
   ```

5. **Apply Guard via Limes**: Limes evaluates the `runtimeContext` (the DO
   instance) against the user's capabilities.
   ```yaml
   # Access check in the Dashboard
   operator: AND
   matchers:
     - type: matchPermission
       value: PRODUCT_SIGN_ALLOWED
     - type: matchScopeIntersection
       permission: PRODUCT_SIGN_ALLOWED
       property: customers # Fallback to company/person context if needed
   ```

## 4. Domain Object Dashboard

The `user-home` will feature a dynamic **DO Dashboard** component.

### Capabilities:

- **Discovery**: Queries the `doRegistryService` for all instances.
- **Filtering**: Filters visibility using
  `limes.isAllowed(user, 'DO_VIEW', instance)`.
- **Action Rendering**: Dynamically renders action buttons if
  `limes.isAllowed(user, action.id, instance)` returns true.
- **Action Dispatching**: Clicking an action (e.g., `sign`) triggers a
  `shell-launch-flow` with the DO instance as a parameter.

```javascript
// Example Action Dispatch
async function triggerAction(actionId, doInstance) {
  // 1. Resolve Flow for Action
  const flowId = actionId === "sign" ? "cases" : "bo-details";

  // 2. Launch with DO Context
  targetElement.dispatchEvent(
    new CustomEvent("shell-launch-flow", {
      detail: {
        id: flowId,
        params: {
          doId: doInstance.id,
          strategyId: doInstance.strategyId,
          action: actionId,
        },
      },
    }),
  );
}
```
