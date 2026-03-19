# Domain Object Architecture

The Antigravity application revolves around **Domain Objects (DO)** as its core architectural paradigm. To create a flexible, dynamic system that supports visually-built, persistent, stateful interactive flows without writing hardcoded frontend or backend logic for every new feature, we have separated the Domain Object architecture into three distinct layers.

## The 3-Layer Model

Every feature lifecycle in the system (e.g. creating a Business Account, managing a License, drafting an Email) is modeled using this 3-tier architecture:

### 1. DO Blueprint (The Specification Schema)
- **What it is:** The declarative configuration file (typically a `.yaml` file).
- **Format:** Contains atomic UI flow definitions (Steps and Parts), allowed Case Types, Action bindings, and Properties (like the `strategyId` and `pmKey`).
- **Role:** Purely a template or schema. It defines *what* the domain object looks like, what inputs it requires, and what buttons are available. 
- **Creation:** Authored by developers or business analysts via the **Visual DO Editor**.

### 2. DO Strategy (The Execution Engine)
- **What it is:** A JavaScript OSGi service (e.g., `LocalStrategy`, `FirestoreStrategy`) that implements the `prototyper.domain.strategy` interface.
- **Role:** The Strategy dictates *how* a Blueprint is executed. It acts as the Controller.
- **Scope of a Strategy:**
  1. **User Interface Mounting:** The Strategy parses the Blueprint and registers necessary OSGi `flows` (like wizard processes) into the Shell.
  2. **Persistence Management (PM):** The Strategy dictates exactly *where* and *how* data is stored. For instance, a `LocalStrategy` might persist data to the browser's `localStorage` (perfect for prototyping). A `FirestoreStrategy` will read the Blueprint's `pmKey` (e.g., `collection: "business-orders"`) and handle Firebase network boundaries.
  3. **Action Routing:** When a user clicks a button inside an active UI flow, the Strategy receives the event and routes the parameter payload to the correct internal API or external integrations.
  4. **State Transitions:** Governs the lifecycle rules (Draft -> Active -> Archived) defined by the Blueprint.

### 3. DO Instance (The Persisted Data Record)
- **What it is:** The actual data object saved in a database, representing a real-world entity constructed from a Blueprint.
- **Format:** A JSON document.
- **Role:** An Instance possesses a unique ID, references its parent Blueprint, tracks the user's progress through the UI flow (e.g. "User is currently on Step 2"), and permanently stores any captured dynamic inputs (`selectedMemberId`, `greeting`).
- **Lifecycle:** 
  1. A user clicks "Instantiate" on a Blueprint. 
  2. The DO Strategy creates a shell Instance in the database.
  3. As the user navigates the flow, the UI Engine periodically asks the Strategy to save the state fragment to the Instance record.
  4. If the user leaves and clicks "Resume", the Strategy fetches the exact Instance record from persistence, rebuilding the UI identically.

## The DO Registry UI Restructure

To visually represent this architecture to system administrators, the **Domain Object Registry** application is structured into three parallel columns reflecting the three architectural layers:

1. **DO Blueprints (Design & Deploy):** Lists available YAML schemas. Here you can edit the Visual layouts or click *Instantiate* to create a new record.
2. **DO Execution Engines (System Diagnostics):** Lists active running Strategy variants registered in the OSGi container. It is a read-only list for validating system readiness.
3. **Persisted Instances (Data & Execution):** Lists active records fetched from the database, grouped by their Strategy's persistence layer. Here you resume flows or edit underlying data blocks.

## Execution Flow Example

**Scenario:** *User wants to order a Business Account.*

1. **Blueprint:** The `business-account-order.yaml` blueprint declares: "I need a `LocalStrategy` execution engine. Provide a 3-step UI wizard, and save records under the `pmKey: business-orders`."
2. **Launch:** The user visits the Registry, finds the `business-account-order` Blueprint, and clicks "Instantiate".
3. **Strategy Initialization:** `LocalStrategy` intercepts the command, generates a UUID for the new record (e.g., `order-101`), creates a JSON object in `localStorage` under the `business-orders` bucket, and commands the OSGi Shell to launch the UI flow with `instanceId=order-101`.
4. **Resuming Work:** If the user stops at Step 2 and closes the browser, they can return to the Registry, look at the **Persisted Instances** column, and click `order-101`. `LocalStrategy` loads the saved state, injects the variables into the `ui-factory`, and restarts the render exactly at Step 2.
