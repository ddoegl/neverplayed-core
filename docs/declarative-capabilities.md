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
`subject:verb:attribute` (e.g., `documents:manage:allowed`).

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

- **Cumbersome & Error-Prone**: Manually setting permissions for users of legal
  representatives is tedious and unnecessary.
- **Lack of Uniformity**: Automated permissioning is fragmented across different
  services without a centralized logic engine.
- **Opaque Logic**: The "why" behind an assigned permission-key is often buried
  in provider-side code rather than being declaratively visible.

### 2.2 Target State: Capability Manifest (Forward-Looking)

To overcome the limitations of the "As-Is" state, the system is evolving towards
a uniform, declarative **Capability Manifest** model driven by a centralized
**Permission Resolver**.

#### 2.2.1 The Capability Manifest

Instead of hardcoding logic triggers, each functional **Feature** defines its
access rules in a structured **Capability Manifest**. A manifest defines a
**Capability**—a cohesive set of **Permission Keys** and the rules that govern
them.

- **Capability**: A logical grouping of related permissions (e.g., "Messenger").
- **Keys**: Standardized `subject:verb:attribute` identifiers belonging to the
  capability.
- **Rules**: A hierarchy of logical operators (`AND`, `OR`, `NOT`) that evaluate
  conditions, often starting with a **Feature Availability** check.
- **Contextual Attributes**: Rules can reference user attributes (e.g.,
  `isLegalRep`), resource attributes (e.g., `ownerId`), or environmental state
  (e.g., `timeOfDay`).

#### 2.2.2 The Permission Resolver

The Resolver is a generic engine that resolves access:

1. **Ingestion**: Loads all registered Capability Manifests from a Config
   Service.
2. **Resolution**: Given a `User Context`, it traverses the rule graph to derive
   a set of `Permission Key`s.
3. **Traceability**: Unlike hidden provider-side code, the decision logic is
   fully inspectable and auditable within the manifest itself.

**Functional Outcome:**

- **Zero-Code Updates**: Changing a business rule for "Legal Representatives"
  only requires a manifest update, not a code change or manual admin
  intervention.
- **Uniformity**: All services use the same Resolver, ensuring consistent
  behavior across the entire ecosystem.

### 2.3 Manifest Granularity Strategies

Breaking down the "scope to be guarded" requires balancing developer autonomy
with system-wide observability.

| Strategy            | Approach                           | Pros                                         | Cons                                         |
| :------------------ | :--------------------------------- | :------------------------------------------- | :------------------------------------------- |
| **Feature-Based**   | One manifest per feature/product.  | High cohesion; local ownership; easy gating. | Potential logic duplication across features. |
| **Domain-Based**    | One manifest per subject/entity.   | Clear entity boundaries; predictable CRUD.   | Features cross-cut multiple entities.        |
| **Global Monolith** | One large manifest for everything. | Full observability; no ingestion issues.     | Merge conflicts; hard to manage lifecycle.   |
| **Package-Based**   | Tied to technical bundles.         | Aligns with deployment units.                | technical boundaries != business boundaries. |

**Recommended Strategy**: **Feature-Based** manifests are preferred. This allows
individual product teams to evolve their capabilities independently while using
`matchFeature` as a global master switch.

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

The **Permission Resolver** uses these relations to filter the returned scope:

- `matchRelation`: A Layer 1 primitive that verifies the specific bond (e.g.,
  `isLegalRepFor(customer_id)`).
- `filterScope`: In addition to a boolean "yes/no," the Resolver can return a
  list of IDs to which the capability applies.

### 3.3 Defining the Scope in the Manifest

The scope of a capability is a first-class citizen in the declarative manifest:

- **`scope: relational`**: The permission-key is restricted to specific
  customers. This is the default for most business-sensitive capabilities.
- **`scope: license-holder`**: The permission-key is scoped to the **main
  contractor** (License Holder). This allows both the contractor and privileged
  representatives (e.g., accountants) to access the same member context.
- **`scope: license-wide`**: The permission-key applies to the entire license.
  Consuming services distinguish two modes here:
  - **Mode `ALL` (Default)**: Explicitly lists every license member in the
    returned `filterScope`. This ensures consuming systems have a declarative
    list available by default.
  - **Mode `ANY`**: Implicitly covers any member associated with the license
    without naming them explicitly. This is used as a **shortcut** when no
    consumer requires the explicit list.

### 3.4 How `filterScope` is Determined

The **Permission Resolver** calculates the `filterScope` dynamically during the
resolution phase:

1. **Relation Collection**: The Resolver scans the `User Context` for all active
   relations (e.g., `Relation(Type: LegalRep, Target: Customer_A)`).
2. **Matcher Evaluation**: When a rule encounters a `matchRelation: legal_rep`
   primitive, it identifies not just _if_ there is a match, but _which_ targets
   caused the match.
3. **ID Extraction**: The Resolver pulls the unique identifiers (e.g.,
   `Customer_A`) from the successful relations.
4. **Resolution**: The resulting `filterScope` is the intersection of the
   permitted scope defined in the manifest and the active relations found in the
   user's context.

### 3.5 Tenant Aggregation

A **License** acts as a cross-tenant aggregator. It can contain **License
Members** (Customers) belonging to different **Tenants**.

- **Shared Capabilities**: Capabilities are defined at the License level and
  apply across all members, regardless of their tenant.
- **Tenant Context**: While access is granted at the license level, the **Tenant
  Context** of each individual member is preserved for downstream routing and
  configuration (e.g., specific subjects or localized rules).

---

## 4. Architectural Layers

The solution is organized into distinct layers to separate intent, evaluation,
and distribution.

### 3.1 Layer 1: Rule Strategies

These are the **core matching primitives** used to evaluate business intent.
Strategies are atomic, reusable logic units that the Permission Resolver uses to
determine if a condition is met.

**Supported Primitives:**

- `matchAlways`: Evaluates to `true` in all contexts.
- `matchFeature`: Matches if a specific feature flag is currently enabled.
- `matchLicensemember`: Matches if the owner of the user-id is themselves a
  member of the license (e.g., a self-employed person).
- `matchRelation`: Matches if the user has a specific relation (e.g.,
  Organizational Role, Legal Representative, Authorized Delegate) with a given
  scope.
  - **Specifying Level**: Can be extended with specific sub-roles:
    - `legal_rep`: `liable_owner`, `managing_partner`, `managing_director`,
      `authorized_signatory`.
    - `authorized_delegate`: `general`, `cardadministration`, `guarantee`,
      `letter_of_credit`.
- `matchProperty`: Matches if a given context property matches a required value.

- **Purpose**: To provide a standardized set of logic blocks that can be
  composed into complex rules.

### 3.2 Layer 2: Capability Strategies

In this layer, the strategy terms (matchers) defined in Layer 1 are **composed
into rules** and associated with specific **assignment outcomes**.

- **Feature Guarding**: A capability strategy typically uses the `matchFeature`
  primitive at its root. If the feature is not active for the license, the
  entire capability and its keys are skipped.
- **Composition**: Combines multiple Rule Strategies using logical operators
  (`AND`, `OR`, `NOT`).
- **Outcome**: Maps the result of the rule evaluation to the actual granting or
  denial of a capability key.

### 3.3 Layer 3: Permission Keys

Layer 3 consists of the **well-known permission-keys** themselves. These keys
are the elements of the assignment outcomes defined in Layer 2.

- **Role**: They serve as the "output" of the evaluation process.
- **Format**: Standardized `subject:verb:attribute` strings that the rest of the
  system understands.

---

## 4. Evaluation Flow

The evaluation flow supports both **Pull** (on-demand requests) and **Push**
(event-driven updates) mechanisms.

### 4.1 Runtime Evaluation (Pull & Push)

1. **Context Injection**: The system is provided with a **User Context**
   (attributes, roles, ownership, etc.).
2. **Rule Evaluation (Layers 1 & 2)**: The Permission Resolver applies the
   defined capability rules. It evaluates the **composed matchers** (Layer 2) by
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

The Permission Resolver aggregates inputs from multiple sources, applying them
in the following order of priority (highest at the top):

1. **Customer Administrator Overrides**: Explicitly assigned permission-keys set
   by the customer's admin. This is the **"Last Say"** and overrules all
   provider-side settings.
2. **Provider Manifest-Driven Rules**: Declarative, conditional logic (e.g.,
   granting broader permissions to Legal Representatives based on attributes).
3. **Provider Logic Triggers**: Base-level business logic that automatically
   grants default permissions (e.g., when a new product instance is created).

### 5.2 Conflict Resolution: The Merge Policy

The Resolver applies a **Refined Union with Override** strategy:

- **Discovery**: The Resolver collects all potential permission-keys from all
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
4. **`messenger:view:targeted_messages`**: View personal messages explicitly
   targeted at the current user as the "Owner" or "Signatory".

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

The feature `messenger` defines the `Messenger` Capability in a manifest:

```yaml
# messenger-capabilities.yaml
capability: "Messenger"
guard:
  matchFeature: "messenger" # The "Master Switch" for this set of keys

capabilities:
  - key: "messenger:manage:conversations"
    scope: relational # Restricted to specific customers
    rule:
      OR:
        - matchRelation: "owner"
        - matchRelation: "legal_rep"
        - matchRelation: "admin_override"

  - key: "messenger:view:conversations"
    scope: relational
    rule:
      OR:
        - matchRelation: "legal_rep"
        - matchRelation: "authorized_delegate"

  - key: "messenger:view:targeted_messages"
    scope: relational
    rule:
      matchRelation: "owner" # Exclusive to the owner of the user

  - key: "messenger:manage:light_conversations"
    scope: license-wide
    mode: ALL # Returns an explicit list of all customer IDs in the license
    rule: matchAlways
```

**Outcome**: When the user logs in, the Resolver sees the "legal_rep" relation
in the context and **immediately grants** the keys scoped to that specific
customer. No admin intervention required.

### 6.4 Message Topic Governance

Access to specific communication channels (Topics) is also governed by the
manifest, ensuring that sensitive routing rules are always followed.

| Topic                 | Accessibility                               | Governed By                                     |
| :-------------------- | :------------------------------------------ | :---------------------------------------------- |
| **`support`**         | **All Users**                               | Public `light_conversation` primitive.          |
| **`account_manager`** | Users with `messenger:manage:conversations` | Requires specific license-member assignment.    |
| **`privileged`**      | **Legal Representatives** only              | Automatically granted based on `matchRelation`. |
| **`targeted`**        | **Owner** of the user                       | Exclusive to the Signatory.                     |

- **Note on Subjects**: Subjects are the granular "reasons" for a conversation.
  They are **not** defined within the Capability Manifest.
  - **Tenant-Specific Mapping**: The mapping of **Subjects to Topics** is
    managed in a separate **Tenant Configuration**. This allows different
    tenants to have a unique set of subjects (with their own routing) for the
    same shared topic (e.g., `support`).
  - **Resolver's Role**: The **Permission Resolver** only manages the "Who can
    access which Topic" boundary. The actual subjects available to a user are
    resolved by intersecting the permitted topics with the tenant's specific
    mapping.

#### Manifest Representation (Granular Topics)

```yaml
# messenger-topics.yaml
# The 'subjects' listed here are foreign keys to the Routing Service.
topics:
  - id: "support"
    scope: license-wide
    mode: ALL # Available to all member in the license
    rule: matchAlways

  - id: "account_manager"
    scope: relational # Scoped to the customer the user manages
    rule:
      HAS_CAPABILITY: "messenger:manage:conversations"

  - id: "privileged"
    scope: relational
    rule:
      AND:
        - matchRelation: "legal_rep"
        - HAS_CAPABILITY: "messenger:manage:conversations"

  - id: "targeted"
    scope: relational
    rule:
      matchRelation: "owner"
```

In this model, a Legal Representative doesn't just get the "manage" capability;
the **Permission Resolver** ensures they also have access to the `privileged`
topics necessitated by their role, while a regular staff member with "manage"
permissions is restricted to standard `account_manager` topics.

---

## 7. Illustrative Example: Campaign Orchestrator

The **Campaign Orchestrator** leverages the Permission Resolver to deliver
targeted content (Promotions, News, and Alerts) based on the subject's real-time
context.

### 7.1 The Goal: Contextual Delivery

Unlike static permissions, **Campaigns** are dynamic. A user should only see a
"Platinum Upgrade" promotion if they meet specific criteria (e.g., they have a
high transaction volume or a specific relation).

### 7.2 Manifest Representation (Promotions)

Promotions are treated as a specialized type of **Capability**. The Resolver
returns `campaign:view:ID` keys for every eligible promotion.

```yaml
# promotions-manifest.yaml
capability: "Promotions"
guard:
  matchFeature: "campaign_engine"

capabilities:
  - key: "campaign:view:platinum_upgrade"
    scope: license-wide
    rule:
      AND:
        - matchProperty: {
            path: "user.segment",
            operator: "==",
            value: "high_value",
          }
        - matchRelation: "liable_owner"

  - key: "campaign:view:new_feature_onboarding"
    scope: license-wide
    rule:
      AND:
        - matchFeature: "advanced_analytics"
        - NOT:
            matchProperty: {
              path: "user.onboarding_completed",
              operator: "==",
              value: true,
            }

  - key: "campaign:view:loyalty_discount"
    scope: relational
    rule:
      matchRelation: "legal_rep" # Only shown for customers where user is Legal Rep

  - key: "campaign:view:enterprise_upsell"
    scope: license-wide
    rule:
      AND:
        - matchRelation: "admin"
        - matchProperty: {
            path: "license.member_count",
            operator: ">",
            value: 3,
          }
        - matchProperty: { path: "license.user_count", operator: ">", value: 5 }
```

### 7.3 Processing Flow

1. **Context Hydration**: The system injects the full user profile (segment,
   onboarding status, license metrics) into the Resolver.
2. **Rule Evaluation**: The Resolver evaluates each promotion rule to identify
   the set of eligible `campaign:view:ID` keys.
3. **Backend Hydration**: A dedicated **Promotion Service** intercepts the
   Resolver's output and fetches the creative content (images, localized text,
   deep links) from the CMS for the identified IDs.
4. **Consolidate & Deliver**: The backend delivers the **fully hydrated
   promotion objects** to the Frontend.

**Outcome**: The Frontend remains a "thin" consumer of pre-processed,
pre-hydrated content, while all business logic and content assembly are
centralized in the Backend infrastructure.

---

## 8. Validation & Simulation (Dry Runs)

As the complexity of Capability Manifests grows, the risk of unintended
consequences increases. To ensure a "flawless configuration," the system
supports a robust **Validation & Simulation** harness.

### 8.1 Pre-Fabricated User Contexts

The system maintains a library of **Test Contexts**—pre-fabricated sets of user
attributes, relations, and license metrics.

- **"Jagged" Contexts**: A collection of atypical user scenarios (e.g., a
  self-employed user who is also a Legal Rep for another license and has a high
  transaction volume).
- **Growth**: This harness grows over time as new edge cases are discovered in
  production, creating a safety net for future manifest updates.

### 8.2 The Dry Run Service

Before deploying a manifest change, Experts can trigger a **Dry Run**:

1. **Input**: A proposed manifest update + a selection of Test Contexts.
2. **Execution**: The Permission Resolver evaluates the proposed rules against
   the contexts in a sandboxed environment.
3. **Outcome Projection**: The service returns a diff showing exactly how
   permissions and campaigns would change for those specific users.

### 8.3 Automated Regression Testing

Manifest updates can be integrated into CI/CD pipelines. If a change causes a
regression in a "Critical Path" test context (e.g., a Legal Rep loses access to
privileged topics), the deployment is automatically blocked.

---

## 9. Agent-Supported Orchestration

To further lower the barrier to entry, the system includes an **AI Configuration
Agent** that assists Subject Matter Experts in creating and maintaining
manifests.

### 9.1 Conversational Intent Capture

Experts do not need to write YAML by hand. They can describe their intent in
natural language (e.g., *"I want to show the 'Platinum' campaign to all company
directors who have been with us for more than 2 years"*).

### 9.2 Scrutiny & Edge-Case Analysis

The Agent does more than just translate text to YAML; it actively scrutinizes
the request for pitfalls:

- **Security Checks**: Identifying if a rule inadvertently grants broad access.
- **Conflict Detection**: Checking if the new rule overlaps or conflicts with
  existing manifest entries.
- **Edge-Case Proposing**: Suggesting "jagged" contexts the Expert might have
  overlooked (e.g., *"What should happen if the user is a director but their
  license has been suspended?"*).

### 9.3 Integrated Validation Loop

The Agent is directly connected to the **Dry Run Service**. It automatically:

1. Generates the YAML.
2. Runs the simulation against the Test Harness.
3. Explains the projected outcomes back to the Expert in plain language.
4. Requests final approval before committing the change.
