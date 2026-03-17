# Specification: Declarative Infrastructure (Configuration-over-Code)

## 1. Vision & Core Philosophy
The core imperative of this specification is **Configuration over Code**. In a modern, scalable ecosystem, business logic, authorization rules, and marketing orchestrations should not be hardcoded. Instead, the application serves as a generic execution engine that hydrates its behavior from declarative manifests.

## 2. Capability Engine (Rule-Based Access)
Instead of static Role-Based Access Control (RBAC), the system implements an **Attribute-Based Access Control (ABAC)** model driven by configuration.

### 2.1 Capability Manifest
Each feature or component defines its required capabilities in a declarative format:
- **Keys**: Unique resource identifiers (e.g., `DOCUMENTS_VIEW`).
- **Matchers**: Logical operators (`AND`, `OR`, `NOT`) that evaluate user attributes against environmental state.
- **Criteria**: Dynamic conditions such as `matchRole`, `matchLicenseFeature`, or `matchScope`.

### 2.2 Global Evaluator
The Evaluator is a technology-agnostic engine that:
1.  Loads all registered Capability Manifests.
2.  Interprets the current state (User Session + Environment).
3.  Returns a boolean or a filtered scope for any requested feature, without requiring a redeploy for rule changes.

---

## 3. Campaign Orchestrator (Targeted UX & Logic)
Campaigns are transient or persistent behavior overlays that adjust the user experience based on targeted segments.

### 3.1 Campaign Manifest
A Campaign definition includes:
- **Targeting**: Defines *who* sees the campaign (e.g., "Users without active accounts in the last 30 days").
- **Triggers**: Defines *when* the action occurs (e.g., `onDashboardLoad`, `onTransactionFail`).
- **Actions**: The declarative instruction for the UI (e.g., `showModal`, `injectPromoBanner`, `triggerTutorial`).
- **Priority & Exclusivity**: Rules to handle multiple overlapping campaigns.

### 3.2 Dispatcher Logic
The Orchestrator listens for system-wide triggers and matches them against active Campaign manifests. If a match is found and targeting criteria are met, the action is dispatched to the corresponding UI renderer.

---

## 4. Topic Registry (Declarative Event System)
The event-driven backbone of the system must be strictly governed to prevent "event chaos."

### 4.1 Topic Manifest
Topics are not created ad-hoc in code; they are registered via configuration:
- **Topic ID**: Standardized hierarchy (e.g., `order/lifecycle/created`).
- **Schema**: Definition of the expected data payload (Type-safety for event data).
- **Access Control**: Who is allowed to `publish` to this topic vs. who can `subscribe`.
- **Retention & Reliability**: Configuration for persistence or delivery guarantees (e.g., `RetryStrategy`, `Persistent`).

### 4.2 Event Router
A centralized router ensures that events are only dispatched if they meet the registered schema and security constraints defined in the Topic Manifest.

---

## 5. Discovery & Lifecycle
To maintain the "Configuration over Code" imperative, the system must support:
- **Hot-Reloading**: Updating a YAML/JSON configuration should update the system behavior in real-time without a restart.
- **Decentralized Registration**: Components (bundles) should "announce" their parts of the configuration upon startup.
- **Persistence Layer**: Configurations can be stored in version control, databases, or local storage, but the execution interface remains identical.

## 6. Functional Benefits
1.  **Zero-Code Adjustments**: Requirements engineers or Product Owners can adjust behavior by modifying YAML files.
2.  **Environment Parity**: The same code behaves differently in `UAT` vs `PROD` strictly through configuration differentials.
3.  **Auditability**: The state of the system's "brain" is easily inspectable in human-readable manifests.
