# Component Binding Patterns in Alpine + OSGi

When dynamically loading flows and rendering their templates into shell
containers (like `index.html`'s `flow-container`), we must reliably bridge the
global OSGi module scope into the local Alpine UI reactivity tree.

Over time, we've encountered multiple race conditions regarding how Alpine
parses DOM elements arriving via `.innerHTML` versus when it registers data
stores.

## The Problem: "_x_dataStack Injection"

Previously, we used this pattern to inject state into freshly loaded HTML:

```javascript
// AVOID THIS PATTERN
const state = Alpine.reactive({ count: 0 });
targetElement._x_dataStack = [state]; // Manually forcefully seeding Alpine's internal stack
targetElement.innerHTML = await fetch("view.html").text();
```

While this works _if_ the container is fully isolated, it fails critically if
`targetElement` is already located inside an active Alpine DOM tree (like
`<div x-data="shell">... <div id="flow-container"></div></div>`).

Because Alpine's `MutationObserver` instantly scans the new `innerHTML` content
relying on the parent's boundaries, it completely ignores the manual
`_x_dataStack` property patch on the child node, resulting in silent failures
where `@click="toggle()"` events do nothing because the handler is undefined in
the parent scope.

## The Solution: "Fresh Factory" Pattern

To guarantee that a dynamically loaded flow creates its own dedicated, clean
Alpine reactivity scope, we must use the **Fresh Factory** pattern.

Instead of trying to inject a pre-bound `Alpine.reactive` proxy hidden in
javascript, we expose a **plain Javascript setup function** to `globalThis` that
Alpine naturally calls during its DOM parsing phase via an explicit `x-data`
attribute in the template.

### 1. Activator definition

Expose a factory function, creating a closure over any OSGi dependencies
(`context`, `configAdmin`, etc).

```javascript
// activator.js
launch: async (targetElement) => {
    // Expose a fresh factory producing plain objects
    globalThis.getMyFlowScope = () => {
        return {
            count: 0,
            init() { ... },
            increment() { this.count++; }
        };
    };
    
    // Inject HTML
    targetElement.innerHTML = await fetch("view.html").text();
}
```

### 2. Template markup

Initialize the component by invoking the global factory in the root `x-data`
attribute. Alpine will automatically wrap the returned object in its reactive
proxy system locally.

```html
<!-- view.html -->
<!-- Explicit x-data execution isolates the DOM tree -->
<div x-data="globalThis.getMyFlowScope()">
  <button @click="increment()">Add</button>
</div>
```

**Benefits**:

- Highly deterministic: The scope is evaluated strictly when Alpine reaches the
  DOM node.
- Context-safe: Variables like `this` correctly refer to the localized Alpine
  Proxy state, while surrounding closures (`ca`, `context`) refer to the OSGi
  Activator context.
- Resilient: Works perfectly even when injected deep within existing `x-data`
  shell trees.

## Alternative: Fragment Shadowing via `_x_dataStack`

Used extensively in `config-admin` for inserting reactive fragments into a
shared shell container without breaking the parent component's boundaries.

### 1. Activator definition

Inject the reactive proxy directly onto the target element's internal stack
BEFORE setting `innerHTML`.

```javascript
// activator.js
launch: (async (targetElement) => {
  const state = Alpine.reactive({ count: 0 });
  targetElement._x_dataStack = [state]; // Seed the stack
  targetElement.innerHTML = await fetch("view.html").text();
  state.init?.();
});
```

### 2. Template markup

NO `x-data` is needed in the template. Alpine's expression evaluator will climb
the DOM tree looking for `_x_dataStack` properties.

```html
<!-- view.html -->
<div>
  <button @click="count++" x-text="count"></button>
</div>
```

**When to use**:

- Use **Fresh Factory** for standalone pages or full-screen flows (e.g.
  `backoffice-web`).
- Use **Fragment Shadowing** for smaller UI utilities injected into existing
  dashboards (e.g. `config-admin`, `poc-evaluator`).

## Global Service Discovery via `shared-types.js`

To prevent "magic string" fragmentation and runtime `null` pointer exceptions,
all OSGi service interfaces and flow IDs must be centralized in
`osgi/shared-types.js`.

### 1. Centralize the Constant

Never use literal strings for `getServiceReference()` or `registerService()`.

```javascript
// osgi/shared-types.js
export const MY_CORE_SERVICE = "prototyper.core.MyService";
```

### 2. Robust Retrieval (Lazy Loading)

Because OSGi bundles start asynchronously, a service might not be available
exactly when `start(context)` is called. Components should use a lazy-loading
helper to ensure they can recover if a service arrives later (e.g., after a user
interaction).

```javascript
// activator.js
import { MY_CORE_SERVICE } from "../../../shared-types.js";

export default class Activator {
  start(context) {
    this.context = context;
    // ... initial setup ...
  }

  // Helper to always get the freshest reference
  getCoreService() {
    if (this._service) return this._service;
    const ref = this.context.getServiceReference(MY_CORE_SERVICE);
    if (ref) {
      this._service = this.context.getService(ref);
    }
    return this._service;
  }
}
```

**Rule of Thumb**:

- **Registration**: Always use the constant from `shared-types.js`.
- **Consumption**: Always use a getter/helper that can re-query the
  `BundleContext` if the local reference is null.
- **Timing**: If a service is critical for a UI component, call the getter
  inside the Alpine `init()` or `launch()` method, not just in the bundle's
  `start()` method.

## Persistence Patterns

The project follows a "Local-First" persistence strategy using the OSGi
`PersistenceManager` (`@pandino/persistence-manager-api`).

### 1. Bundle Configuration (`ConfigAdmin`)

For bundle-specific settings (e.g. `logLevel`, `featureFlags`, `theme`), use the
`ConfigAdmin` service.

- **Priming (Manifest Defaults)**: Define default settings in the
  `manifest.json` under the `Configuration` header. `ConfigAdmin` will
  automatically prime these into storage on bundle start if they don't exist.
- **Consumption**: Always use
  `configAdmin.getConfiguration(BSN).getProperties()` to read settings.
- **Persistence**: Calling `config.update({ ... })` automatically triggers a
  `pm.store()` and dispatches a `config-updated` event.

### 2. Domain Data (Seed & Persist)

For complex business data (e.g. `licenses.yaml`, `persons.yaml`), follow the
**Seed & Persist** pattern in your activator.

1. **Attempt Load**: Try to load from `PersistenceManager` using a unique PID.
2. **Fallback to Seed**: If empty, `fetch` the static YAML/JSON asset from the
   bundle.
3. **Hydrate & Store**: Parse the asset, store it in PM to "lock" it for future
   sessions, and register the data service.

```javascript
// Example: activator.js
const stored = pm.load(DATA_PID);
if (!stored) {
  const raw = await fetch("./data/seed.yaml").then((r) => r.text());
  const data = yaml.load(raw);
  pm.store(DATA_PID, data);
}
```

### 3. Reactive Session Persistence (Alpine Effect)

For global UI state (e.g. `environment`, `currentUser`), use the **Alpine
Effect** pattern established in `index.html`.

- Define the service as an `Alpine.reactive()` object.
- Use `Alpine.effect(() => { pm.store(ID, state); })` to automatically sync any
  property change to `localStorage` without manual `save()` calls.

### 4. Direct Persistence (Primitive)

For simple key-value pairs not requiring reactive binding or OSGi discovery, use
the `PersistenceManager` directly:

- `pm.store(key, value)`
- `pm.load(key)`
- `pm.remove(key)`
