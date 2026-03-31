# Architecture Patterns: Backoffice Reactivity & State Management

This document outlines the core architectural patterns used for building
reactive and consistent user interfaces within the Pandino Backoffice ecosystem.

---

## 1. The `$watch` Pattern for Cross-Context Reactivity

When building complex "Master/Detail" interfaces using Alpine.js and OSGi
services, we often encounter scenarios where multiple data sources need to stay
in sync.

### The Problem

Alpine.js reactivity is scoped to the `x-data` component. However, in our
system, the "Host" (the Backoffice Shell) often provides a reactive Proxy
(`host`) that contains the global state. Changing a selection in a sidebar
(Master view) might not automatically trigger a re-render of a Detail view if
the detail view relies on a local reference established during `x-init`.

### The Solution: `$watch`

We use the Alpine.js `$watch` magic property to explicitly monitor changes in
the global state or local selection indices and update internal component
references accordingly.

**Example: Master/Detail Selection Sync**

```html
<div
  x-data="{ 
    selectedIdx: 0,
    strat: null
  }"
  x-init="
    strat = host.parsedData[selectedIdx];
    $watch('selectedIdx', value => { 
        strat = host.parsedData[value];
    });
  "
>
  <!-- Sidebar -->
  <template x-for="(item, idx) in host.parsedData">
    <div @click="selectedIdx = idx">...</div>
  </template>

  <!-- Detail View -->
  <div x-text="strat.name"></div>
</div>
```

**Where it is used:**

- `backoffice-capabilities` (Strategy selection sync)
- `backoffice-campaigns` (Campaign strategy selection sync)
- `backoffice-topics` (Topic strategy selection sync)
- `backoffice-licenses` (User/License selection sync)
- `backoffice-sca` (SCA strategy management)

---

## 2. Component Binding Patterns (Alpine + OSGi)

When dynamically loading flows and rendering their templates into shell
containers (like `index.html`'s `flow-container`), we must reliably bridge the
global OSGi module scope into the local Alpine UI reactivity tree.

### The "Fresh Factory" Pattern (Recommended)

Used for standalone pages or full-screen flows (e.g. `backoffice-web`). Instead
of trying to inject a pre-bound `Alpine.reactive` proxy, we expose a **plain
Javascript setup function** to `globalThis` that Alpine naturally calls during
its DOM parsing phase via an explicit `x-data` attribute in the template.

**Activator Setup**:

```javascript
launch: (async (targetElement) => {
  globalThis.getMyFlowScope = () => ({
    count: 0,
    increment() {
      this.count++;
    },
  });
  targetElement.innerHTML = await fetch("view.html").text();
});
```

**Template Markup**:

```html
<div x-data="globalThis.getMyFlowScope()">
  <button @click="increment()">Add</button>
</div>
```

### Fragment Shadowing (Alternative)

Used for smaller UI utilities injected into existing dashboards (e.g.
`config-admin`, `poc-evaluator`). We inject a reactive proxy onto the target
element's internal `_x_dataStack` property.

**Activator Setup**:

```javascript
launch: (async (targetElement) => {
  const state = Alpine.reactive({ count: 0 });
  targetElement._x_dataStack = [state]; // Seed the stack
  targetElement.innerHTML = await fetch("view.html").text();
});
```

---

## 3. Mandatory Architectural Constant Compliance

To prevent "magic string" fragmentation, broken service trackers, and runtime
`null` pointer exceptions, **all** OSGi service interfaces, configuration PIDs,
and global Event Topics **must** be centralized in `public/shared-types.js`.

### The Compliance Rule

1. **Registration**: Never hardcode a service name in `registerService`. Import
   and use the constant.
2. **Consumption/Tracking**: Use the constant in LDAP filters (e.g.,
   `(objectClass=${LOG_SERVICE})`) and when retrieving services.
3. **Alpine Injections**: When injecting constants into reactive Alpine strings
   (e.g., in `x-effect`), use template literals:
   `globalThis.Services['${LOG_SERVICE}'].info(...)`.

### Benefits

- **Refactor Safety**: Changing a service ID in one place updates the entire
  system.
- **Discovery Integrity**: Prevents subtle typos from breaking service trackers
  or event listeners.

---

## 4. Persistence Patterns

The project follows a "Local-First" persistence strategy using the OSGi
`PersistenceManager`.

1. **Bundle Configuration**: Use `ConfigAdmin` for settings (log levels, feature
   flags). It handles defaults via `manifest.json` and dispatches
   `config-updated` events.
2. **Domain Data (Seed & Persist)**:
   - **Attempt Load**: Try to load from `PersistenceManager` using a unique PID.
   - **Fallback to Seed**: If empty, `fetch` the static YAML/JSON asset from the
     bundle.
   - **Hydrate & Store**: Parse and store it in PM to "lock" it for future
     sessions.
3. **Reactive Session Persistence**: Use
   `Alpine.effect(() => { pm.store(ID, state); })` for global UI state to
   automatically sync property changes to `localStorage`.

---

## 5. Configuration over Code (The Bridging Pattern)

To ensure smooth transitions between legacy data formats and modern composable
structures:

- **Detection**: Check for legacy properties (e.g., `strat.primitive`) in `x-if`
  templates.
- **Migration**: Provide a non-destructive "Upgrade" action that transforms the
  data into the new harmonized format (`matchers` array).
- **Normalization**: Ensure internal getters (e.g., `availableFeatures`) handle
  diverse data sources reactively.

---

## 6. Cross-Flow Event Signaling

In a decoupled OSGi architecture, bundles often need to request actions from one
another without direct object dependencies. We achieve this via standard DOM
events and the `@pandino/event-admin` for background tasks.

### The "Modal Signal" Pattern

Used when an embedded subflow (e.g., `invitation-admin`) needs the host (e.g.,
`company-authorizations`) to launch a slide-over modal on its behalf.

**Subflow Dispatch**:

```javascript
targetElement.dispatchEvent(
  new CustomEvent("invitation-admin-request-modal", {
    detail: { step: "person-details", type: "employee" },
    bubbles: true,
  }),
);
```

**Host Listener & Late-Binding State**:

When the host receives the request, it loads the subflow and then "late-binds"
specific state parameters onto the subflow's Alpine proxy via its
`_x_dataStack`.

```javascript
targetElement.addEventListener("invitation-admin-request-modal", (e) => {
  const { step, type, code } = e.detail;

  // 1. Load the subflow into the modal container
  state.loadSubFlow("invitation-admin", step);

  // 2. Late-bind specific state params via nextTick or timeout
  setTimeout(() => {
    const container = document.getElementById("subflow-modal-container");
    if (container && container._x_dataStack && container._x_dataStack[0]) {
      const subState = container._x_dataStack[0];
      if (type) subState.invitationType = type;
      if (code) {
        subState.invitation = subState.filteredInvitations.find(
          (i) => i.code?.toUpperCase() === code?.toUpperCase(),
        );
      }
    }
  }, 250);
});
```

**Benefits**:

- **Decoupling**: The subflow doesn't need to know how the host renders modals.
- **Consistency**: The host maintains control over the UI container
  (slide-over).
- **Flexibility**: Works regardless of whether the subflow is embedded or
  standalone.

---

## 7. The `onActivate` Hook (Dynamic Injection)

In a portal/host architecture where multiple sub-flows share a single reactive
state (`hostState`), we use the `onActivate` hook to inject business logic
methods into the host precisely when the sub-flow is selected.

### The Problem

Different flows (e.g., `user-management` vs. `company-settings`) might need to
provide different implementations for a common placeholder method (e.g.,
`performAction`). If these methods are injected only during bundle `start`, they
can be overwritten by other bundles or missing if the portal restarts.

### The Solution

Define an `onActivate` method in the flow object. The Host (Portal) is
responsible for calling this hook whenever the user navigates to this specific
flow.

**Sub-flow Activator**:

```javascript
const serviceObj = {
  id: "my-flow",
  onActivate: (hostState) => {
    // Inject specific logic only when this flow is active
    hostState.performAssignment = (id, target) => {
      /* logic */
    };
  },
};
```

**Host Discovery/Activation**:

```javascript
// When loading a step
const flow = registeredFlows.find((f) => f.id === stepId);
if (flow && typeof flow.onActivate === "function") {
  flow.onActivate(this.state); // 'this.state' is the reactive portal state
}
```

---

## 8. Resilient Service Retrieval (On-Demand Lookup)

To handle OSGi race conditions and late-arriving infrastructure services, avoid
storing service references as class members or module-level variables.

### The Problem

If a bundle looks up a service (e.g., `LICENSE_DATA_SERVICE`) during its `start`
phase and the provider bundle hasn't registered it yet, the reference remains
`null` for the lifetime of the bundle, causing intermittent runtime failures.

### The Solution: On-Demand Helper

Implement a small `getSvc` helper within the scope of your business logic
methods. This ensures the service is re-queried from the `BundleContext` every
time it is needed.

**Example: Resilient Activator Pattern**

```javascript
onActivate: ((hostState) => {
  const getSvc = (sid) => {
    const ref = context.getServiceReference(sid);
    return ref ? context.getService(ref) : null;
  };

  hostState.saveOperation = () => {
    const svc = getSvc(MY_SERVICE_ID);
    if (!svc) {
      console.error("Service not available yet!");
      return;
    }
    svc.performSave();
  };
});
```

**Benefits**:

- **Robustness**: Immune to bundle startup order.
- **Self-Healing**: If a provider bundle is restarted (updated), the consumer
  automatically picks up the new service instance.
- **Testability**: Easier to mock context-based lookups than module-level
  globals.

---

## 9. Reactive Data Projection (Projection Pattern)

When bridging local bundle data (e.g. from `PersistenceManager`) to the global
Backoffice `hostState`, we must ensure the projection is established during the
active lifecycle of the UI.

**In `activator.js` -> `onActivate`**:

```javascript
onActivate: ((hostState) => {
  // Project local data into hostState for Alpine usage
  hostState.myLocalData = myInternalData;

  // Logic that operates on the projected data
  hostState.performAction = () => {
    myInternalSvc.process(hostState.myLocalData);
  };
});
```

This pattern ensures that the UI always has access to a reactive reference that
triggers re-renders, while keeping the source of truth managed within the
bundle's internal scope.

---

## 10. Defensive Data Normalization

Alpine.js can exhibit unexpected behavior (like iterating over characters of a
string instead of items in an array) if data types vary. We use defensive
normalization when loading or storing data.

1. **Array Enforcement**: Always check if a property is an array before storing
   it in the host state or PM.
2. **Value Guarding**: Filter out null/undefined values to prevent UI crashes.

**Example**:

```javascript
const normalize = (data) => {
  if (data && Array.isArray(data.items)) {
    data.items = [...new Set(data.items.filter(Boolean))];
  } else if (data && typeof data.items === "string") {
    data.items = [data.items]; // Convert to list
  }
};
```

This is especially important for properties like `licenseholder` or `customers`
which might be edited by hand in YAML files or registry editors.

---

## 11. Dual-Bridge Reactivity Pattern (OSGi + DOM)

When dealing with deeply embedded flows where OSGi `EventHandler` updates might
be delayed or partially blocked by Alpine.js's component lifecycle, we use a
"Dual-Bridge" approach.

### The Problem

An OSGi `EventHandler` registered in an activator might receive an event (e.g.,
`invitations/updated`), but if the Alpine state it tries to update is part of a
sub-flow that was dynamically injected, reactivity might not propagate
immediately to the UI elements.

### The Solution

1. **Service-to-Service (OSGi)**: Continue using `@pandino/event-admin` for
   decoupled service logic.
2. **Service-to-UI (DOM)**: Dispatch a standard DOM CustomEvent on `globalThis`.
   This allows any Alpine component in the tree to listen directly via
   `@event-name.window` and trigger a local `updateTrigger`.

**Provider (e.g., Invitation Service)**:

```javascript
publishEvent(context, topic, data) {
  // 1. OSGi Bridge
  eventAdmin.postEvent(eventFactory.build(topic, data));
  
  // 2. DOM Bridge (Global Signal)
  const domTopic = topic.replaceAll('/', '-'); // e.g., 'invitations-updated'
  globalThis.dispatchEvent(new CustomEvent(domTopic, { detail: data }));
}
```

**Consumer (e.g., Authorizations Dashboard)**:

````html
<div
  x-data="{ updateTrigger: 0 }"
  @invitations-updated.window="updateTrigger++"
>
  ...
</div>

--- ## 12. The Limes Guarding Pattern (ENTITY_ACTION) To ensure a predictable
and surgical authorization architecture, all business modules must follow the
`ENTITY_ACTION` naming convention for Limes strategies. ### The Pattern
Strategies should be named using an uppercase prefix for the entity type,
followed by an underscore and the action name (also uppercase). -
**Visibility**: Use `${ENTITY}_VIEW` (e.g., `CASE_VIEW`, `PRODUCT_VIEW`) for
general resource visibility. - **Actions**: Use `${ENTITY}_${ACTION}` (e.g.,
`CASE_SIGN`, `PRODUCT_TRADE`) for specific state transitions or operations. ###
Implementation in Domain Objects The `backoffice-do-registry` supports this
pattern via a `limesPrefix` property in the strategy definition. ```yaml id:
product-strategy limesPrefix: PRODUCT actions: - id: sign label: Authorize
Product
````

The evaluator will automatically resolve this to `PRODUCT_VIEW` and
`PRODUCT_SIGN` when querying Limes.

### Benefits

- **Predictability**: Developers know exactly what strategy ID to register or
  query.
- **Surgical Control**: Avoids "God Strategies" by separating visibility from
  specific actions.
- **Discoverability**: Standardized names are easier to find in the Limes
  Management UI.

---

## 13. Flow Registration & Discovery Pattern

For flows to be correctly discovered by portals (like the Business Portal or
Backoffice) and filtered by channel, they must provide specific metadata during
OSGi service registration.

### The Problem

Bundles that register a `FLOW_SERVICE` but omit service properties are invisible
to portals that use `ServiceTrackers` with LDAP filters. While the manifest's
`Configuration` object is used for initial system setup, the **runtime
registration** is the source of truth for navigation.

### The Solution

Always provide a properties object as the third argument to
`context.registerService`.

**Required Properties:**

- `flow.id`: A unique string identifier (e.g., `do-dashboard`).
- `flowType`: Categorization for the portal (e.g., `service-flow`,
  `backoffice-flow`).
- `channels`: An array of channel IDs where this flow should be visible (e.g.,
  `["business-channel-web"]`).

**Example: Standard Flow Registration**

```javascript
context.registerService(FLOW_SERVICE, {
  id: "my-flow",
  title: "My Flow",
  launch: (container) => {/* ... */},
}, {
  "flow.id": "my-flow",
  "flowType": "service-flow",
  "channels": ["business-channel-web"],
});
```

### Benefits

- **Automatic Navigation**: Portals will automatically pick up and display the
  flow in the sidebar based on the current channel.
- **Early Filtering**: Allows portals to filter out flows that shouldn't be
  accessible in specific environments (e.g., hiding backoffice tools from retail
  users).
- **Consistency**: Bridges the static manifest declaration with the dynamic OSGi
  service registry.

---

## 14. Limes Evaluation & Identity Resolution

To ensure consistent authorization results across different UI contexts (Shell
vs. Portal), always pass the **User ID** (string) to Limes instead of the raw
session user object.

### The Problem

Limes' `isAllowed(userOrId, ...)` method is overloaded:

1. **Pass a String (ID)**: Limes performs an on-demand lookup in the global
   Evaluation State to find the **fully enriched capability object**. This
   object contains the mapped permissions, features, and pre-filtered Domain
   Objects.
2. **Pass an Object**: Limes assumes the object **is** the already-enriched
   capability object. If you pass a raw session user object, it lacks the
   required permission metadata, causing all checks to fail silently.

### The Solution

Always use the User ID to leverage the system's evaluation pipeline.

**Correct Pattern (e.g., in sub-flows):**

```javascript
const userId = session.currentUser?.id;
// This triggers a full capability lookup
const allowed = limes.isAllowed(userId, "MY_STRATEGY", myContext);
```

**Incorrect Pattern:**

```javascript
const user = session.currentUser;
// Limes will treat 'user' as the enriched capability object and fail to find permissions!
const allowed = limes.isAllowed(user, "MY_STRATEGY", myContext);
```

### Benefits

- **Context Independence**: Works in the Backoffice Shell and Business Portal
  regardless of how the session is stored locally.
- **Data Integrity**: Ensures you are checking against the system's "Ground
  Truth" for a user's permissions, which may be more extensive than the basic
  session data.
- **Simplicity**: Reduces the need to pass heavy objects between different
  layers of the UI.

---

## 15. Navigation Stability & Partial Shell Updates

To prevent flickering and preserve UI state (like open dialogs) during
background service refreshes, shell clients must use defensive partial update
logic.

### The Problem

If a shell activator re-renders the entire main content area (`innerHTML = ""`)
whenever it receives a navigation request or a "step updated" signal, it
destroys all active DOM nodes, including Alpine components and their local
states (dialogs, form inputs).

### The Solution: `data-active-step` Tracking

Instead of just checking if the `stepId` is the same, shells should track the
**rendered** state using a data attribute on the content container.

**Correct "Stable" Implementation:**

```javascript
const contentArea = document.getElementById("content-area");
const isSameStep = this.currentStep === targetId;
const isAlreadyRendered = contentArea &&
  contentArea.dataset.activeStep === targetId;

if (isSameStep && isAlreadyRendered) {
  // Skip DOM destruction!
  // Just trigger child activation logic if needed.
  if (extension.onActivate) extension.onActivate(this);
  return;
}

// Perform update and tag the container
contentArea.innerHTML = newHtml;
contentArea.dataset.activeStep = targetId;
```

**Benefits:**

- **Zero Flickering**: Seamless transitions for background updates.
- **State Preservation**: Dialogs and overlays remain active.
- **Performance**: Skips expensive DOM parsing and Alpine initialization for
  redundant calls.

---

## 16. Reactive Lifecycle & Zombie Guards (Persistence Safety)

When building complex, long-lived components like the `ui-factory` that use
`Alpine.effect` to sync with global states, we must defensively manage their
lifecycle to prevent "Zombie Effects" from corrupting data.

### The Problem: Ghost Overwrites

If a component registers global effects (e.g., watching
`globalThis.backofficeState`) but is not explicitly cleaned up when the DOM node
is removed, the effects stay active in memory. When the global state updates,
multiple instances of the component (old sessions) may wake up simultaneously
and "Auto-Save" their stale local data, effectively overwriting the user's
latest changes.

### The Solution: The "Double-Guard" Pattern

1. **Zombie Guard**: Always check if the component is still connected to the DOM
   at the start of an effect.
2. **Hydration Guard**: Ensure persistence only happens _after_ the component
   has successfully synchronized with its source of truth.

**Example: Robust Lifecycle Management**

```javascript
class MyComponent extends HTMLElement {
  constructor() {
    super();
    this._effects = [];
    this._isDisconnected = false;
  }

  disconnectedCallback() {
    this._isDisconnected = true;
    this._effects.forEach((cleanup) => cleanup());
  }

  _createState() {
    const effect = Alpine.effect(() => {
      // 1. Exit immediately if zombie
      if (this._isDisconnected) return;

      // 2. Hydration Guard (Logic)
      if (!this.state.hydrated) {
        this.hydrate();
        return;
      }

      // 3. Perform Persistence
      pm.store(ID, this.state.values);
    });
    this._effects.push(effect);
  }
}
```

### Benefits

- **Data Integrity**: Prevents stale sessions from winning race conditions.
- **Memory Efficiency**: Explicitly destroys reactive computations.
- **Predictability**: Ensures the "Last Save Wins" only applies to the active
  UI.

---

## 17. Non-Destructive Reactive Rendering (The Focus Guard)

When building Custom Elements that use `Alpine.effect` or other reactive
triggers to re-render, we must avoid destructive `innerHTML` updates that cause
user focus loss in input fields.

### The Problem

A standard `render()` method that sets `this.innerHTML = template` every time a
value changes will destroy all active DOM nodes. If the user is currently typing
in an `<sl-input>` inside that template, the element is removed and recreated,
causing the cursor to vanish.

### The Solution: Idempotent Shell + Targeted Updates

1. **Idempotent Shell**: Use an `_initialized` flag to ensure the main layout is
   only set once.
2. **Targeted Sub-updates**: In the `render()` loop, use `this.querySelector()`
   to update specific text nodes, attributes, or sub-containers.
3. **Contextual Regeneration**: Only blow away sub-containers (like a property
   panel) if the _context_ (e.g., the selected ID) actually changed.

**Example Pattern**:

```javascript
render() {
    // 1. Initialize Shell Once
    if (!this._initialized) {
        this.innerHTML = `
            <div id='container'>
                <div id='preview'></div>
                <div id='editor'></div>
            </div>
        `;
        this._initialized = true;
    }

    // 2. Targeted Updates
    this.querySelector('#preview').innerText = this.state.previewText;
    
    // 3. Conditional Regeneration (Focus Preservation)
    if (this._activeId !== this.state.selectedId) {
        this._activeId = this.state.selectedId;
        this.querySelector('#editor').innerHTML = `<input value='${this.state.val}'>`;
    }
}
```

**Where it is used:**

- `atomic-input.js` / `atomic-select.js` (Direct property updates)
- `atomic-visual-editor.js` (Tri-view synchronization)
- `ui-factory.js` (Atomic component updates)

---

## 18. Decentralized Action Registration (Action Registry)

To ensure that UI actions (like "Order New User" or "Create Case") are
discoverable and reusable across different contexts (CLI, UI Factory, Visual
Editor), bundles must register their capabilities via the
`ACTION_REGISTRY_SERVICE`.

### The Pattern

Instead of hardcoding action logic into specific buttons, bundles register
"Action Definitions" that include metadata (label, description) and parameter
requirements.

**Example: Registration in `activator.js`**

```javascript
const registry = context.getService(
  context.getServiceReference(ACTION_REGISTRY_SERVICE),
);
registry.registerAction({
  id: "flows.order.newUser",
  label: "Order New User",
  description: "Initiates the onboarding flow for a new user.",
  params: {
    targetSpace: "The space ID where the user should be added",
  },
  handler: (params) => {
    /* logic */
  },
});
```

### Benefits

- **Self-Documentation**: Automatically populated in `/actions` CLI command.
- **Visual Editing**: Allows the `visual-do-editor` to provide dropdowns of
  available system actions.
- **Decoupling**: The UI Factory can trigger actions by ID without importing the
  providing bundle's code.

---

## 19. Standardized Logging & Balanced Observability

To maintain a clean console while allowing for deep debugging, all bundles must
move away from `console.log` and adopt the standardized `@pandino/log-service`.

### The Pattern

Bundles track the `LOG_SERVICE` and retrieve a tagged logger instance
specifically for their symbolic name.

### The "Balanced Zero-Console" Strategy (Recommended)

While the goal is a silent console ("Zero-Console") for foundation noise, we
must avoid "flying blind" during the earliest system initialization phases.

**Pattern: Safe Early-Boot Fallback**

```javascript
// Attempt to get a logger early (fallback to console for boot observability)
let logger = console;
const logRef = context.getServiceReference(LOG_SERVICE);
if (logRef) {
  logger = context.getService(logRef).getLogger("my.bundle.id");
}
logger.info("Initializing bundle...");
```

**Pattern: Lazy Getter Fallback**

```javascript
get logger() {
    if (this._logger) return this._logger; // Set via ServiceTracker
    if (globalThis.Services?.[LOG_SERVICE]) {
        return globalThis.Services[LOG_SERVICE].getLogger("my.bundle.id");
    }
    return console; // Fallback for early reactive triggers
}
```

---

## 20. Headless Secret Management (Dynamic Injection)

When building OSGi bundles that require sensitive credentials (e.g., API keys, MCP secrets), we must prevent these secrets from being hardcoded in the Javascript source, which would leak them into the browser bundle.

### The Problem

If a bundle like `auth-shield` needs a secret to communicate with a Cloud Function, hardcoding it makes it public. However, a headless Deno agent needs that same secret to operate.

### The Solution: The Dynamic Injection Pattern

1. **Bundle (Client)**: Consume the secret from a global context variable (e.g., `globalThis.NEVERPLAYED_MCP_SECRET`) with a safe fallback to an empty string.
2. **Headless Host (Deno)**: Load the secret from a local, gitignored environment file (`.env.mcp`) and inject it into the global scope before starting the OSGi bundles.
3. **Browser Host**: (Optional) In a production browser environment, use App Check or Firebase Auth instead of the static secret for the same endpoint.

**Bundle Implementation**:

```javascript
// src/firebase-auth.js
const response = await fetch(fnUrl, {
    method: "POST",
    headers: {
        "x-mcp-secret": globalThis.NEVERPLAYED_MCP_SECRET || ""
    },
    // ...
});
```

**Headless Host (Deno) Implementation**:

```typescript
// scripts/mcp-server.ts
const envText = Deno.readTextFileSync("./.env.mcp");
const match = envText.match(/MCP_API_SECRET=(.*)/);
if (match) {
    (globalThis as any).NEVERPLAYED_MCP_SECRET = match[1].trim();
}
```

### Benefits

- **Zero Hardcoding**: The secret is never stored in version control.
- **Portability**: The same bundle works in the browser (limited mode) and headless (full power).
- **Rotation Safety**: Secrets can be rotated in Secret Manager and the `.env.mcp` file without changing code.


### Dynamic Configuration

The logging infrastructure is integrated with `ConfigAdmin`. Log levels can be
adjusted in real-time via:

1. **Manifest**: `Configuration: { "log-level": "WARN" }` for defaults.
2. **Universe Settings UI**: Using the "Log Level" column dropdown.
3. **Shell CLI**: `/loglevel DEBUG [ids]`.

### Benefits

- **Granular Filtering**: Change the verbosity of a single bundle without
  affecting others.
- **Production Safety**: Defaults can be set to `WARN` or `ERROR` to avoid
  leaking sensitive data in logs.
- **Tagging**: Every log message is automatically prefixed with the bundle's
  name for easier tracing.

---

## 20. Capability-Based Discovery (Handle Pattern)

To achieve maximum modularity and decouple the Shell (and other consumers) from
hardcoded bundle IDs, we use **Capability-Based Discovery**.

### The Pattern

Instead of a consumer (like the Shell Host) tracking a specific bundle PID, it
tracks a generic interface (like `FLOW_SERVICE`) and filters by a `capability`
property.

**Provider (e.g., `shell-cli`)**:

```javascript
context.registerService(FLOW_SERVICE, flowSvc, {
  "capability": "sys:cli",
  "flow.id": "@neverplayed/shell-cli", // Legacy fallback
});
```

**Consumer (e.g., `shell-host`)**:

```javascript
context.trackService(`(&(objectClass=${FLOW_SERVICE})(capability=sys:cli))`, {
  addingService: (ref) => {
    const flow = context.getService(ref);
    flow.launch(container);
  },
});
```

### Benefits

- **Interchangeability**: You can swap the Shell CLI bundle with a different
  implementation without updating the Shell Host.
- **Discovery Simplicity**: Consumers don't need to import internal PID
  constants; they only need to know the name of the "Capability" they require.

---

## 21. Standardized Service Identifiers (Hierarchy)

To ensure a predictable registry across the platform, we follow a strict naming
hierarchy for service identifiers.

### 1. Global Interfaces

Common contracts shared by many bundles. These are defined as top-level
constants.

- `@neverplayed/flow-service`
- `@pandino/log-service`

### 2. Private Bundle Services

Specific APIs provided by a single bundle for other bundles to consume directly.

- Pattern: `@neverplayed/<simple-name>/service`
- Example: `@neverplayed/shell-cli/service`

### 3. Capability Namespaces

When defining capabilities (Handle Pattern), use a colon-separated namespace.

- **`sys:`**: System infrastructure (e.g., `sys:cli`, `sys:logging`).
- **`auth:`**: Security domain (e.g., `auth:login`).
- **`biz:`**: Business domain flows (e.g., `biz:dashboard`).
- **`cap:`**: Generic UI capabilities (e.g., `cap:yaml-editor`).

### Benefits

- **Conflict Avoidance**: Namespaces prevent collisions between "Login" in the
  Backoffice vs. "Login" in a Retail App.
- **Scannability**: Service Registry dumps become easier to read when names
  follow a logical hierarchy.

---

## 22. Service Implementation Styles (Class vs. Literal)

To ensure a predictable and discoverable service registry, we follow specific
guidelines for implementing OSGi services.

### 1. Object Literal (The "Lite" Pattern)

Best for simple, stateless, or singleton-like services where minimal boilerplate
is preferred.

- **Pros**: Low verbosity, no `this` binding concerns.
- **Cons**: Method discovery via reflection can be noisier if not correctly
  filtered.

```javascript
const myService = {
  doWork: (params) => {
    /* logic */
  },
  getStatus: () => "active",
};
context.registerService(MY_SERVICE, myService);
```

### 2. Class Instance (The "Robust" Pattern) - RECOMMENDED

Best for complex services with internal state, private logic, or those that
benefit from inheritance.

- **Pros**: Cleaner prototype-based reflection, clear API surface, better
  structure.
- **Cons**: Requires careful `this` binding in callbacks.

```javascript
class MyService {
  constructor(context) {
    this.ctx = context;
  }
  saveData(data) {
    /* logic using this.ctx */
  }
}
context.registerService(MY_SERVICE, new MyService(context));
```

### 3. Discovery Guidelines

The Shell CLI's `/methods` command is designed to handle both styles by
traversing the prototype chain and explicitly filtering out internal Javascript
engine methods (`toString`, `valueOf`, etc.).

---

## 23. Identity-Aware Persistence & Readiness Pattern

As the system moves toward cloud-backed state (Firebase), bundles must handle
asynchronous data hydration and identity synchronization to prevent race
conditions and data leaks.

### The Problem: Asynchronous Boot

High-level services (like `Limes` or `ConfigAdmin`) often rely on persisted
state to function. If these services start before the `PersistenceManager` has
finished fetching data from the cloud (hydration), they will load stale or
empty "factory" defaults, leading to inconsistent security checks or UI states.

### The Solution: The `waitReady()` Pattern

All persistence implementations must provide a `waitReady()` method that
returns a `Promise`. Critical services must await this promise during their
`start` or `onActivate` phase.

**1. Persistence Provider (Activator)**:

```javascript
context.registerService(PERSISTENCE_MANAGER_SERVICE, {
  waitReady: () => this._readyPromise, // Resolves after Cloud Hydration
  load: (key) => this._cache.get(key),
  store: (key, val) => { /* ... sync to Firestore ... */ }
});
```

**2. Service Consumer (e.g., Limes)**:

```javascript
async onStart(context) {
  context.trackService(`(objectClass=${PERSISTENCE_MANAGER_SERVICE})`, {
    addingService: async (pm) => {
      await pm.waitReady(); // MANDATORY: Wait for cloud sync
      this.loadStrategies(pm);
    }
  }).open();
}
```

### Identity Synchronization

Cloud persistence is scoped to the `uid` of the authenticated user. The
persistence manager must track the `AUTH_SHIELD_SERVICE` and trigger
re-hydration whenever the user identity changes.

### Benefits

- **Reliability**: Guarantees that the UI and security layer are always based on
  the latest "Ground Truth."
- **Security**: Prevents cross-user data leakage by enforcing identity-scoped
  hydration.
- **Performance**: By using an internal cache that is populated once during
  boot, subsequent `load()` calls remain synchronous and fast.
