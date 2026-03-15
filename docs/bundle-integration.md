# Bundle Integration Guide

This guide describes how to create and integrate a new bundle into the
OSGi-inspired web architecture. A complete bundle typically includes UI, Data
management, Event handling, and Configuration.

## Bundle store

All bundles are stored in the `osgi/bundles` directory, categorized by their
primary intent.

```text
osgi/bundles/
├── environments/          # Hardware/Reality simulations (Mobile, Browser, Space-Time)
├── system-services/      # Infrastructure (EventAdmin, ConfigAdmin, Persistence)
├── system-clients/       # Administrative tools (Backoffice, Registries, Monitors)
├── user-services/        # Domain logic (Invitations, Notifications, Payments)
├── user-clients/         # Primary user interfaces (Mobile App, Web Portal)
├── flows/                # Reusable business processes (Orders, SCA, Onboarding)
└── real-life/            # The "God View" entry point
```

## Bundle Structure

Follow this standard layout for consistency:

```text
my-feature-bundle/
├── activator.js        # Entry point: registers services/flows
├── manifest.json       # Metadata: identity, dependencies, channels and default configuration for ConfigAdmin
├── config.json         # definition of steps in the flow, binding to templates
├── templates/          # HTML pieces (Alpine.js templates)
│   ├── dashboard.html
│   └── detail.html
├── data/               # Seed data or default state
│   └── initial.yaml
├── css/                # Bundle-specific styles
│   └── styles.css
└── images/             # Local assets
    └── icon.svg
```

> [!NOTE]
> **Separation of Concerns**: Keep UI logic in `activator.js` limited to
> template loading. Move heavy business logic into a dedicated **Service**
> exposed via the Pandino context.

## 1. Manifest (`manifest.json`)

Every bundle must have a `manifest.json` in its root directory. This file
defines the bundle's identity, dependencies, and capabilities.

```json
{
  "Bundle-SymbolicName": "my-feature-bundle",
  "Bundle-Name": "My Feature",
  "Bundle-Version": "1.0.0",
  "Bundle-Activator": "./activator.js",
  "Bundle-Assets": "templates/dashboard.html, templates/persona.html",
  "Require-Capability": [
    "osgi.service; filter:=\"(objectClass=prototyper.yaml.service)\"",
    "osgi.service; filter:=\"(objectClass=@pandino/event-admin/EventAdmin)\""
  ],
  "Configuration": {
    "flowType": "admin-flow",
    "channels": ["real-life"]
  }
}
```

- **Bundle-Activator**: Path to the entry point (JS class).
- **Bundle-Assets**: A comma-separated list of assets (templates, YAMLs, etc.)
  relative to the bundle root. The Shell performs a sanity check before starting
  the bundle. If any asset is missing (404), the bundle will NOT be started, and
  a warning will be logged.
- **Configuration**: Metadata used by the Shell to determine where and how to
  display the flow (e.g., `channels` like `real-life` or
  `business-channel-web`).

## 2. Activator (`activator.js`)

The activator is a class with a `start(context)` method. This is where you
register services, track dependencies, and initialize the UI.

### Data Persistence

Use the `PersistenceManager` to save and load state. It's best practice to
separate Data into its own service.

```javascript
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);
    const STORAGE_PID = "my.feature.storage";

    let data = pm.load(STORAGE_PID) || { items: [] };

    const dataService = {
      getData: () => data,
      save: (newData) => {
        data = newData;
        pm.store(STORAGE_PID, data);
      },
    };
    context.registerService("my.feature.data", dataService);
  }
}
```

### Event Handling

Emit and consume events via `EventAdmin`.

```javascript
// Emit Event
const eventAdmin = context.getService(
  context.getServiceReference("@pandino/event-admin/EventAdmin"),
);
const eventFactory = context.getService(
  context.getServiceReference("@pandino/event-admin/EventFactory"),
);
eventAdmin.postEvent(
  eventFactory.build("my/topic/updated", { action: "add", item: newItem }),
);

// Consume Event
context.registerService("@pandino/event-admin/EventHandler", {
  handleEvent: (event) => {
    console.log("Received:", event.getTopic(), event.getData());
  },
}, { "event.topics": ["some/other/topic"] });
```

### UI & Flow Registration

Register your bundle as a "Flow" to make it launchable in the Shell.

```javascript
import { FLOW_SERVICE } from "../../shared-types.js";

const flowMetadata = {
  id: "my-feature",
  title: "My Feature UI",
  icon: "fas fa-star",
  launch: async (targetElement) => {
    const res = await fetch("./bundles/my-feature/templates/main.html");
    targetElement.innerHTML = await res.text();
    // Initialize Alpine.js or other logic here
  },
};
context.registerService(FLOW_SERVICE, flowMetadata, {
  "flow.id": "my-feature",
});
```

## 3. Configuration (`ConfigAdmin`)

The system uses `ConfigAdmin` to manage dynamic settings (e.g., visibility).
Each bundle's `channels` can be toggled via the "Universe Settings" UI.

To react to configuration changes:

```javascript
import { CONFIG_ADMIN_SERVICE } from "../../shared-types.js";

const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
const ca = context.getService(caRef);
const config = ca.getConfiguration("my-feature-bundle");
const props = config.getProperties(); // contains { channels: [...] }
```

## 4. Integration via `index.html`

Finally, add your bundle's manifest path to the `manifests` array in
`osgi/index.html` to ensure it is installed and started during the shell's boot
sequence.

```javascript
const manifests = [
  // ...
  "./bundles/my-feature/manifest.json",
  // ...
];
```
