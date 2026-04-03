# Gold Standard: Bundle Manifest Specification

This document establishes the mandatory structure and naming conventions for all bundle manifests in the NeverPlayed ecosystem.

## 1. Mandatory Fields

| Field | Requirement | Format / Example |
| :--- | :--- | :--- |
| `Bundle-SymbolicName` | **Mandatory** | `org.neverplayed.<name>` (Lowercase, dot-separated) |
| `Bundle-Name` | **Mandatory** | `Shell Header UI` (Title Case) |
| `Bundle-Description` | **Mandatory** | `Core UI component for navigation and session management.` |
| `Bundle-Version` | **Mandatory** | `1.0.0` (Semver compliant) |
| `Bundle-Activator` | **Mandatory** | `activator.js` (Relative path, no leading `./`) |

## 2. Configuration Block

The `Configuration` block is used for environment-specific settings and UI discovery.

| Field | Scope | Description |
| :--- | :--- | :--- |
| `flowType` | UI Flows | `system-flow`, `backoffice-flow`, `user-flow`, `business-flow` |
| `channels` | UI Flows | `["business-channel-web", "retail-channel-app"]` |
| `sidebar` | UI Flows | `true` or `false`. Determines visibility in navigation. |
| `capability` | Services | OSGi Capability string (e.g., `sys:cli`) |
| `icon` | UI Flows | FontAwesome class (e.g., `fas fa-cog`) |
| `mountPoint` | UI Hosts | Target CSS selector for rendering (e.g., `#shell-header`) |

## 3. Directory Structure

Manifests must reside at the root of their bundle directory:
`public/bundles/org.neverplayed.<name>/manifest.json`

## 4. Metadata Integrity (QA Checks)

1.  **Duplicate Check**: No two manifests may share the same `Bundle-SymbolicName`.
2.  **Relative Resolution**: `Bundle-Activator` must point to an existing JS file.
3.  **Schema Validation**: Mandatory fields must be present and not empty.
4.  **BSN Path Sync**: The directory name MUST match the `Bundle-SymbolicName` exactly.

## 5. Reactive Flows (Governance)

Bundles providing UI flows should support the **Reactive Flow Governance Pattern**. This requires:
1.  **Activator Listeners**: Tracking `config-updated` to refresh service properties.
2.  **Metadata Parity**: Providing `title` and `icon` in the `Configuration` header to ensure visibility in the central governance UI before the service is fully registered.
