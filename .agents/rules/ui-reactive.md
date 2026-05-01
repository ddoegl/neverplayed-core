## Reactive UI & Platform Safety

- **Alpine.js Authority**: Favor Alpine.js for UI reactivity.
- **State Synchronization**: 
  - Use the `$watch` pattern for cross-context synchronization.
  - Leverage `Alpine.effect` for automatic persistence via `PersistenceManager`.
- **Namespace Isolation**: 
  - Segregate platform infrastructure state from bundle-level logic. 
  - Use `Alpine.store('platform')` for core orchestration (e.g., `kernelReady`).
  - Preserve the `shell` namespace (e.g., `Alpine.store('shell')`) for application/bundle-level data.
- **Robust Variable Resolution**: 
  - Use the global `$uifResolve` magic helper for all standardized UI components. 
  - NEVER rely on naked scope resolution for template variables.
- **Atomic Rendering**: 
  - Always ensure the Alpine `x-data` attribute is firmly established on the DOM element *before* injecting child templates.
