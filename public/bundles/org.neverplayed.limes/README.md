# 🛡️ Limes Security Kernel

The **Limes** bundle is the central authorization and access control engine for the Never Played ecosystem. It implements a hybrid RBAC (Role-Based) and ABAC (Attribute-Based) model using an AST-driven capability evaluator.

## 🏛️ Architecture & Implementation

- **Strategy-Driven Evaluation**: Limes does not hardcode permissions. Instead, it evaluates **Access Strategies** that define logical operations (`AND`, `OR`) over sets of matchers (e.g., `matchPermission`, `matchScopeIntersection`).
- **Dynamic Policy Ingestion**: Strategies are loaded from both a baseline `limes-strategies.yaml` and the `PersistenceManager` (allowing for administrative overrides).
- **Inhabitant Tracking**: Automatically tracks all registered `FLOW_SERVICE` instances to map required permissions into logical viewing strategies.

### Evaluator Logic
The `isAllowed()` method performs deep inspection of the user's **Capability AST**:
- **Permission Match**: Checks for existence of a key (e.g., `realm:admin`).
- **Scope Intersection**: Verifies if the user's allowed scope (e.g., specific `companyIds`) intersects with the object being accessed in the `runtimeContext`.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Constant Compliance** (Pattern 3/ADR-0013) and **Strategic Data Shunting** (Pattern 7/ADR-0003).
- **[ADR-0015: Managed Privilege Injection](../../docs/adr/0015-managed-privilege-injection.md)**: Standardizes how security claims are projected from identity providers into the evaluator.
- **[ADR-0006: Realm Ontology](../../docs/adr/0006-realm-ontology.md)**: Contextualizes permissions within the 5-layer architectural hierarchy.

## 🚀 Future Road

- **Distributed Evaluation**: Support for remote Limes nodes via the MCP bridge.
- **Policy Editor**: A visual strategy builder for the Backoffice.
- **Audit Logging**: Integration with `SystemLogger` to track all denied (and granted) access attempts.
