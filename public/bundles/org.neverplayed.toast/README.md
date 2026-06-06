# org.neverplayed.toast

**Version:** 1.0.0  
**Layer:** Shell / UI Infrastructure

## Purpose

Provides the platform-wide toast notification HUD and the `INTERACTOR_SERVICE` implementation.
Extracted from `org.neverplayed.shared-ui` for clean separation of concerns.

## Registered Services

| Service | Interface | Description |
|---------|-----------|-------------|
| `INTERACTOR_SERVICE` | `org.neverplayed.ui.Interactor` | Universal UI interaction: `notify`, `confirm`, `prompt`, `alert` |

## Alpine Store

**`notifications`**

| Property / Method | Description |
|---|---|
| `toasts` | Array of active toast objects `{ id, message, type, visible }` |
| `push(toast)` | Adds a toast. `toast = { message, type?, duration? }`. Returns generated ID. |
| `dismiss(id)` | Fades out and removes a toast. |

### Toast Types

- `info` — Cyan (default)
- `success` — Emerald
- `warning` — Amber
- `error` — Red

## Usage (from any bundle)

```js
const ref = context.getServiceReference(INTERACTOR_SERVICE);
const interactor = context.getService(ref);

interactor.notify("Login failed: ontological constraint violated.", "error");
interactor.notify("Stratum synchronized successfully.", "success", 3000);
interactor.notify("Sticky message — no auto-dismiss.", "warning", 0);
```
