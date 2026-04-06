---
description: Generates or updates a spec-compliant bundle manifest.
---
# Manifest Generator Workflow

Use this workflow to ensure that a bundle's metadata adheres to the **Never Played Gold Standard**.

1. **Verify Context**: Identify the target bundle directory.
2. **Draft Manifest**: Create or update the `manifest.json` file with the following fields:
   - `Bundle-SymbolicName`: Based on the directory name (must be `org.neverplayed.<name>`).
   - `Bundle-Name`: Human-readable title of the component.
   - `Bundle-Version`: Semver versioning (default `1.0.0`).
   - `Bundle-Activator`: Usually `activator.js`.
3. **Add Configuration**: Include any necessary `Configuration` blocks (e.g., `capability`, `mountPoint`, `flowType`).
4. **Compliance Check**: Verify against `docs/bundle-manifest-spec.md` and `docs/bundle-readme-spec.md` before finalizing.
5. **Draft README.md**: Generate a template `README.md` with:
   - Mandatory Overview and Architecture sections.
   - For Core/Foundation: "The Patterns" section linking to project ADRs.
6. **Verify Files Exist**: Ensure `manifest.json`, `README.md`, and `activator.js` are in place.
