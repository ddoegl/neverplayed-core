# Handover Ticket: Extract Toast Notification System into Dedicated Bundle

**Ticket ID:** TICKET-20260606-1525-EXTRACT-TOAST-BUNDLE  
**From:** Forensic Analyst  
**To:** Development Engineer  
**Status:** OPEN  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Context & Architectural Design

The initial toast notification system was implemented directly inside the `org.neverplayed.shared-ui` activator using inline HTML injection and manual DOM construction. To improve clean encapsulation, separation of concerns, and align with other system overlays (like `stratum-hud`), this logic should be refactored into a brand-new, self-contained OSGi bundle: `org.neverplayed.toast`.

The new bundle will inherit from `AlpineActivator` to handle template rendering and state management cleanly. It will also take over the registration of the `INTERACTOR_SERVICE` (formerly registered in `shared-ui`), providing universal notifications (`notify`) and forwarding standard interactions (`confirm`, `prompt`, `alert`).

---

## 2. Technical Objectives

### Objective 1: Create org.neverplayed.toast Bundle
Scaffold and create a new bundle directory `public/bundles/org.neverplayed.toast/` containing:

1. **`manifest.json`:**
   - Configure symbolic name `org.neverplayed.toast` and version `1.0.0`.
   - Advertise the registered capability `osgi.service; objectClass="org.neverplayed.ui.Interactor"`.
   - Set the default configuration header `mountPoint: "#toast-mount-point"`.

2. **`activator.js`:**
   - Extend `AlpineActivator` from `alpine-base`.
   - In `onStart(context)`, register the Alpine global store `notifications` with:
     - `toasts`: Array of active notifications.
     - `push(toast)`: Adds a toast, generates a unique ID, sets a timeout (default 5000ms), and returns the ID.
     - `dismiss(id)`: Transitions `visible` to `false` and filters it out.
   - Verify or dynamically append `<div id="toast-mount-point"></div>` to `document.body` if not present.
   - Trigger `await this.render('#toast-mount-point', 'templates/toast.html', ...)` to render the reactive template.
   - Register the `INTERACTOR_SERVICE` implementing `confirm()`, `prompt()`, `alert()`, and the custom `notify(message, type, duration)` to push items to the `notifications` store.

3. **`templates/toast.html`:**
   - Define the toast overlay markup using Tailwind CSS glassmorphic styles (`backdrop-blur-md bg-slate-900/80` or similar color variants), responsive flex alignment, high-contrast FontAwesome status icons, and standard Alpine transition attributes.

4. **`README.md` & `tests/`:**
   - Document bundle capabilities and add a test verifying the notification store and interactor registration.

### Objective 2: Clean Up shared-ui Bundle
Clean up `org.neverplayed.shared-ui` Interactor registration:
1. Note: `activator.js` has already been reverted to its original state by the user.
2. In `manifest.json`, remove `osgi.service; objectClass="org.neverplayed.ui.Interactor"` from the `Provide-Capability` header.

### Objective 3: Add to Shell Boot Lifecycle
In `public/realms-secure.html`:
1. Register `"org.neverplayed.toast/": "./bundles/org.neverplayed.toast/"` under the importmap.
2. Append `"./bundles/org.neverplayed.toast/manifest.json"` to the `coreBundles` boot-loading list.

---

## 3. Verification Plan

### Automated Tests
Execute the test suites to ensure no regressions:
```bash
deno task test
```

### Manual Verification
1. Open the application after a data reset (landing in the platonic lobby).
2. Click the viewports or attempt secondary logins to trigger an Ontological Violation.
3. Verify that the toast alert appears at the bottom-right of the screen and that the unhandled rejection red screen does not show up.
