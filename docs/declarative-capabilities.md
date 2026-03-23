# Specification: Declarative Capabilities

## 1. Vision & Core Philosophy

The core imperative of this specification is **Configuration over Code**. In a
modern, scalable ecosystem, business logic, authorization rules, and marketing
orchestrations should not be hardcoded. Instead, the application serves as a
generic execution engine that hydrates its behavior from declarative manifests.

---

## 2. Capability Engine (Rule-Based Access)

### 2.1 As-Is State: Permission Keys

In its current iteration, the system relies on **permission-keys** to guard
specific functionalities. These keys follow a structured format:
`subject:action:attribute` (e.g., `documents:manage:allowed`).

**Delivery Mechanism:**

- **Pull**: Keys are delivered to consumers via standard API calls.
- **Push**: Updates and status changes are broadcast via **Kafka messages** for
  real-time synchronization.
- **Reconciliation**: Full snapshot files are delivered regularly to ensure data
  integrity and catch any missed real-time updates.

**Assignment Mechanism:**

- **Manual Configuration**: Permission-keys are primarily assigned via manual
  configuration by a **Customer Administrator** or a **Provider Service Agent**.
- **Provider-Side Logic Triggers**: Changes on the provider side frequently
  trigger internal business logic that programmatically sets permission-keys for
  both Pull and Push delivery.
- **Custom Attribute-Based Rules**: To reduce manual overhead (e.g., for Legal
  Representatives), some keys are set based on attributes (e.g., owner’s
  attributes or external data). However, these implementations are currently
  done on a case-by-case basis and lack a uniform approach.

**Current Limitations:**

- **Cumbersome & Error-Prone**: Manually setting permissions for sub-users of
  legal representatives is tedious and unnecessary.
- **Lack of Uniformity**: Automated permissioning is fragmented across different
  services without a centralized logic engine.
- **Opaque Logic**: The "why" behind an assigned permission-key is often buried
  in provider-side code rather than being declaratively visible.

### 2.2 Target State: Capability Manifest (Forward-Looking)

To overcome the limitations of the "As-Is" state, the system is evolving towards
a uniform, declarative **Capability Manifest** model driven by a centralized
**Global Evaluator**.

#### 2.2.1 The Capability Manifest

Instead of hardcoding logic triggers, each component or feature defines its
access rules in a structured YAML/JSON manifest:

- **Keys**: Standardized `subject:action:attribute` identifiers.
- **Rules**: A hierarchy of logical operators (`AND`, `OR`, `NOT`) that evaluate
  conditions.
- **Contextual Attributes**: Rules can reference user attributes (e.g.,
  `isLegalRep`), resource attributes (e.g., `ownerId`), or environmental state
  (e.g., `timeOfDay`).

#### 2.2.2 The Global Evaluator

The Evaluator is a generic engine that resolves access in real-time:

1. **Ingestion**: Loads all registered Capability Manifests from a decentralized
   Topic Registry or Config Service.
2. **Resolution**: Given a `Capability Key` and a `User Context`, it traverses
   the rule graph to return a boolean result.
3. **Traceability**: Unlike hidden provider-side code, the decision logic is
   fully inspectable and auditable within the manifest itself.

**Functional Outcome:**

- **Zero-Code Updates**: Changing a business rule for "Legal Representatives"
  only requires a manifest update, not a code change or manual admin
  intervention.
- **Uniformity**: All services use the same evaluator, ensuring consistent
  behavior across the entire ecosystem.

---

## 3. Scoping & License Multi-Tenancy

In complex scenarios where a single **License** involves multiple **Customers**,
permission-keys must be explicitly scoped to define the boundaries of access.

### 3.1 Relation-Based Scoping

Capabilities are not just "on" or "off"; they are applied based on the relation
between the subject and the object(s):

- **Global Scope**: The permission-key applies to **all members** associated
  with the license.
- **Relation Scope**: The permission-key is restricted to only those members
  with whom the subject has a **privileged relation** (e.g., Legal
  Representative, Authorized Delegate).

### 3.2 Dynamic Context Resolution

The **Global Evaluator** uses these relations to filter the returned scope:

- `matchRelation`: A Layer 1 primitive that verifies the specific bond (e.g.,
  `isLegalRepFor(customer_id)`).
- `filterScope`: In addition to a boolean "yes/no," the evaluator can return a
  list of IDs to which the capability applies.

---

## 4. Architectural Layers

The solution is organized into distinct layers to separate intent, evaluation,
and distribution.

### 3.1 Layer 1: Rule Strategies

These are the **core matching primitives** used to evaluate business intent.
Strategies are atomic, reusable logic units that the Global Evaluator uses to
determine if a condition is met.

**Supported Primitives:**

- `matchAlways`: Evaluates to `true` in all contexts.
- `matchFeature`: Matches if a specific feature flag is currently enabled.
- `matchLicenseholder`: Matches if the subject is the main license-holder.
- `matchRelation`: Matches if the user has a specific relation (e.g.,
  Organizational Role, Legal Representative, Authorized Delegate) with a given
  scope.
- `matchProperty`: Matches if a given context property matches a required value.

- **Purpose**: To provide a standardized set of logic blocks that can be
  composed into complex rules.

### 3.2 Layer 2: Capability Strategies

In this layer, the strategy terms (matchers) defined in Layer 1 are **composed
into rules** and associated with specific **assignment outcomes**.

- **Composition**: Combines multiple Rule Strategies using logical operators
  (`AND`, `OR`, `NOT`).
- **Outcome**: Maps the result of the rule evaluation to the actual granting or
  denial of a capability key.

### 3.3 Layer 3: Permission Keys

Layer 3 consists of the **well-known permission-keys** themselves. These keys
are the elements of the assignment outcomes defined in Layer 2.

- **Role**: They serve as the "output" of the evaluation process.
- **Format**: Standardized `subject:action:attribute` strings that the rest of
  the system understands.

---

## 4. Evaluation Flow

The evaluation flow supports both **Pull** (on-demand requests) and **Push**
(event-driven updates) mechanisms.

### 4.1 Runtime Evaluation (Pull & Push)

1. **Context Injection**: The system is provided with a **User Context**
   (attributes, roles, ownership, etc.).
2. **Rule Evaluation (Layers 1 & 2)**: The Global Evaluator applies the defined
   capability rules. It evaluates the **composed matchers** (Layer 2) by
   checking the **rule primitives** (Layer 1) against the provided context.
3. **Key Extraction (Layer 3)**: For every rule that evaluates to `true`, the
   corresponding **permission-keys** are added to the result set.
4. **Result Delivery**:
   - **Pull**: The evaluated outcome is returned directly to the caller (API).
   - **Push**: The outcome is broadcast to the **Topic Registry** (Kafka) to
     sync the consuming services.

### 4.2 Rule Change Propagation (Global Sync)

When a **Capability Manifest** is updated, the system must ensure consistency
across the ecosystem:

- **Trigger**: An update to a Rule (Layer 2) or a Primitive (Layer 1) is
  detected.
- **Impact Analysis**: The system identifies which users or segments are
  affected by the change.
- **Re-Evaluation**: A global re-evaluation is triggered for the affected scope.
- **Broadcast**: Change events are pushed via Kafka for all impacted users,
  ensuring that services transition to the new permission state without manual
  intervention.

---

## 5. Integration & Precedence Strategy

To ensure a cohesive ecosystem, the manifest-driven system integrates with
existing mechanisms through a **Layered Precedence Model**.

### 5.1 The Source Hierarchy

The Global Evaluator aggregates inputs from multiple sources, applying them in
the following order of priority (highest at the top):

1. **Customer Administrator Overrides**: Explicitly assigned permission-keys set
   by the customer's admin. This is the **"Last Say"** and overrules all
   provider-side settings.
2. **Provider Manifest-Driven Rules**: Declarative, conditional logic (e.g.,
   granting broader permissions to Legal Representatives based on attributes).
3. **Provider Logic Triggers**: Base-level business logic that automatically
   grants default permissions (e.g., when a new product instance is created).

### 5.2 Conflict Resolution: The Merge Policy

The Evaluator applies a **Refined Union with Override** strategy:

- **Discovery**: The Evaluator collects all potential permission-keys from all
  three sources.
- **Additive Merging**: By default, the result is the union of all granted keys.
- **Conditional Overrides**:
  - The **Manifest (Level 2)** can extend or refine the defaults from **Logic
    Triggers (Level 3)**.
  - The **Customer Admin (Level 1)** can explicitly grant or revoke any key,
    overriding both levels of provider-side automation.

### 5.3 Practical Example: Messaging Access

- **Logic Trigger (L3)**: "Grant `messenger:manage:light_conversations` as a
  default for all license members upon product creation."
- **Manifest Rule (L2)**: "If user's customer has a `legal_rep` relation with
  them, grant `messenger:view:conversations` and
  `messenger:manage:conversations`."
- **Admin Override (L1)**: "Specifically **revoke**
  `messenger:view:conversations` for this user (e.g., due to a temporary
  internal policy)."
- **Result**: The user can manage light conversations and their own threads, but
  cannot view all threads, as the **L1 Admin Override** takes precedence over
  the **L2 Manifest**.

---

## 6. Illustrative Example: Messaging Feature

This section demonstrates the evolution of a **Messaging Feature** from the
current manual approach to the proposed declarative model.

### 6.1 Feature Definition (Permission-Keys)

1. **`messenger:manage:conversations`**: Create new messaging threads for a
   customer scope. User can see and answer threads they "own" (created
   themselves).
2. **`messenger:view:conversations`**: View all threads across all users for a
   given customer scope.
3. **`messenger:manage:light_conversations`**: Manage public conversations open
   to all customers in the license.

### 6.2 Comparison: As-Is vs. Target State

| Feature                          | As-Is State (Manual/Ad-Hoc)                               | Target State (Manifest-Driven)                                                          |
| :------------------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **`manage:conversations`**       | Explicitly granted by **Admin** for every license member. | **Automated**: Inherited via `matchRelation` (e.g., if user is `legal_rep` or `owner`). |
| **`view:conversations`**         | Explicitly granted by **Admin** for every license member. | **Automated**: Inherited via `matchRelation` for privileged roles.                      |
| **`manage:light_conversations`** | Managed by **Hardcoded Custom Logic** triggers.           | Managed by **Manifest Rules** (unifying defaults across the license).                   |

### 6.3 Achieving Zero-Code Automation

**The Goal**: A user who is the **owner** of a **legal representative** should
automatically receive `view` and `manage` permissions for that customer.

#### As-Is Implementation (Cumbersome)

1. Provider logic detects the legal rep relation.
2. Admin must log in to the dashboard.
3. Admin manually searches for the user and clicks "Grant" for both keys.
4. _Risk_: High latency, manual errors, and "stale" permissions if the relation
   changes.

#### Target Implementation (Declarative Manifest)

The feature defines a manifest that the **Global Evaluator** interprets:

```yaml
# messenger-capabilities.yaml
capabilities:
  - key: "messenger:manage:conversations"
    rule:
      OR:
        - matchRelation: "owner"
        - matchRelation: "legal_rep"
        - matchRelation: "admin_override" # L1 Override

  - key: "messenger:view:conversations"
    rule:
      OR:
        - matchRelation: "legal_rep"
        - matchRelation: "authorized_delegate"
```

**Outcome**: When the user logs in, the Evaluator sees the "legal_rep" relation
in the context and **immediately grants** the keys. No admin intervention
required.

### 6.4 Message Topic Governance

Access to specific communication channels (Topics) is also governed by the
manifest, ensuring that sensitive routing rules are always followed.

| Topic                 | Accessibility                               | Governed By                                     |
| :-------------------- | :------------------------------------------ | :---------------------------------------------- |
| **`support`**         | **All Users**                               | Public `light_conversation` primitive.          |
| **`account_manager`** | Users with `messenger:manage:conversations` | Requires specific license-member assignment.    |
| **`privileged`**      | **Legal Representatives** only              | Automatically granted based on `matchRelation`. |

#### Manifest Representation (Granular Topics)

```yaml
# messenger-topics.yaml
topics:
  - id: "support"
    rule: matchAlways # Open to all

  - id: "account_manager"
    rule:
      HAS_CAPABILITY: "messenger:manage:conversations"

  - id: "privileged"
    rule:
      AND:
        - matchRelation: "legal_rep"
        - HAS_CAPABILITY: "messenger:manage:conversations"
```

In this model, a Legal Representative doesn't just get the "manage" capability;
the **Global Evaluator** ensures they also have access to the `privileged`
topics necessitated by their role, while a regular staff member with "manage"
permissions is restricted to standard `account_manager` topics.
