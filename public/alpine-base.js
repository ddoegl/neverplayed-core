import { BaseActivator, CoreActivator } from "osgi-base";
import Alpine from "alpinejs";

/**
 * AlpineActivator
 * Extends BaseActivator with robust Alpine.js patterns.
 * Provides atomic rendering, store management, and automatic tracker cleanup.
 */
export class AlpineActivator extends BaseActivator {
    constructor() {
        super();
        this._trackers = [];
        this._effects = [];
        this._storeName = null;
    }

    /**
     * track
     * Wraps context.trackService with automatic closing during onStop.
     */
    /**
     * track
     * Overrides base track to ensure availability in controllers.
     */
    track(sid, options) {
        return super.track(sid, options);
    }

    /**
     * initStore
     * Standardized store initialization with existence check.
     */
    initStore(name, defaults) {
        this._storeName = name;
        if (!Alpine.store(name)) {
            Alpine.store(name, {
                ...defaults,
                get activator() { return this; } // Diagnostic backlink
            });
            this.logger?.debug(`[Alpine] Store '${name}' initialized.`);
        } else {
            this.logger?.debug(`[Alpine] Store '${name}' already exists, preserving state.`);
        }
        return Alpine.store(name);
    }

    /**
     * syncStore
     * Surgical update of a specific store property.
     */
    syncStore(name, data) {
        const store = Alpine.store(name);
        if (store) {
            Object.assign(store, data);
        }
    }

    /**
     * effect
     * Registers a global Alpine effect with automatic cleanup.
     */
    effect(fn) {
        const runner = Alpine.effect(fn);
        this._effects.push(runner);
        return runner;
    }

    /**
     * render
     * Hydration-Guarded Template Injection.
     * Automatically registers an Alpine component matching the bundle name.
     */
    async render(targetSelector, templatePath, controllerFactory, attrMap = {}) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            this.logger?.warn(`[Alpine] Render target '${targetSelector}' not found. UI injection skipped.`);
            return null;
        }

        // Atomic Hydration Guard: Prevent double-booting
        const sanitizedBsn = (this.bsn || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
        const initializedKey = `initialized_${sanitizedBsn}`;
        
        if (target.dataset[initializedKey] === 'true') {
            this.logger?.info(`[Alpine] Target '${targetSelector}' already hydrated by ${this.bsn}. Skipping.`);
            return target;
        }
        target.dataset[initializedKey] = 'true';

        // Load Template
        const url = this.resolveResource(templatePath);
        this.logger?.debug(`[Alpine] Fetching template: ${url}`);
        const template = await (await fetch(url)).text();

        // Standardized Controller Name (e.g. org_neverplayed_shell_header_controller)
        const controllerName = `${sanitizedBsn}_controller`;
        
        // Register the data factory
        // Use an arrow function to ensure 'this' refers to the Activator instance
        Alpine.data(controllerName, (...args) => {
            const controller = controllerFactory.apply(this, args);
            
            // Inject Activator Utilities as non-enumerable to prevent Alpine recursion
            Object.defineProperties(controller, {
                logger: { value: this.logger, enumerable: false, writable: true, configurable: true },
                track: { value: this.track?.bind(this), enumerable: false, writable: true, configurable: true },
                initStore: { value: this.initStore?.bind(this), enumerable: false, writable: true, configurable: true },
                syncStore: { value: this.syncStore?.bind(this), enumerable: false, writable: true, configurable: true },
                bsn: { value: this.bsn, enumerable: false, writable: true, configurable: true },
                context: { value: this.context, enumerable: false, writable: true, configurable: true }
            });
            
            return controller;
        });

        // Apply Attributes
        Object.entries(attrMap).forEach(([key, val]) => target.setAttribute(key, val));

        // Inject and Boot
        target.setAttribute('x-data', controllerName);
        target.setAttribute('x-cloak', '');
        target.innerHTML = template;
        
        // Ensure Alpine parses the new DOM
        await Alpine.nextTick();

        // 2.4 Safety Guard: Only initialize if Alpine hasn't already picked it up via MutationObserver
        if (!target._x_dataStack) {
            this.logger?.debug(`[Alpine] Explicit initTree for ${controllerName}`);
            globalThis.Alpine.initTree(target);
        } else {
            this.logger?.debug(`[Alpine] ${controllerName} already initialized via observer.`);
        }
        
        this.logger?.info(`[Alpine] UI Component '${controllerName}' mounted on '${targetSelector}'`);
        return target;
    }


    async stop(context) {
        this._effects.forEach(cleanup => {
            try { cleanup(); } catch (_e) { /* ignore */ }
        });

        // Clear hydration flag to allow re-render on next start
        const sanitizedBsn = (this.bsn || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
        const initializedKey = `initialized_${sanitizedBsn}`;
        document.querySelectorAll(`[data-${initializedKey}]`).forEach(el => {
             delete el.dataset[initializedKey];
        });

        // Standard lifecycle (handles tracker cleanup)
        await super.stop(context);
    }
}

/**
 * CoreAlpineActivator
 * Hybrid activator that merges Core OSGi features (Security/Limes) with Alpine UI patterns.
 */
export class CoreAlpineActivator extends CoreActivator {
    constructor() {
        super();
        this._trackers = [];
        this._effects = [];
    }

    // Mixin the AlpineActivator features... 
    // Since JS doesn't support multiple inheritance, we'll manually proxy the key methods
    // OR just duplicate them for reliability in this specific environment.
    
    track(sid, options) {
        const tracker = this.context.trackService(sid, options);
        this._trackers.push(tracker);
        tracker.open();
        return tracker;
    }

    initStore(name, defaults) {
        if (!Alpine.store(name)) {
            Alpine.store(name, { ...defaults });
        }
        return Alpine.store(name);
    }

    syncStore(name, data) {
        const store = Alpine.store(name);
        if (store) Object.assign(store, data);
    }

    async render(targetSelector, templatePath, controllerFactory, attrMap = {}) {
        const target = document.querySelector(targetSelector);
        if (!target) return null;

        const sanitizedBsn = (this.bsn || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
        const initializedKey = `initialized_${sanitizedBsn}`;
        if (target.dataset[initializedKey] === 'true') return target;
        target.dataset[initializedKey] = 'true';

        const url = this.resolveResource(templatePath);
        const template = await (await fetch(url)).text();
        const controllerName = `${sanitizedBsn}_controller`;
        
        Alpine.data(controllerName, (...args) => {
            const controller = controllerFactory.apply(this, args);
            
            // Inject Activator Utilities as non-enumerable to prevent Alpine recursion
            Object.defineProperties(controller, {
                logger: { value: this.logger, enumerable: false, writable: true, configurable: true },
                track: { value: this.track?.bind(this), enumerable: false, writable: true, configurable: true },
                initStore: { value: this.initStore?.bind(this), enumerable: false, writable: true, configurable: true },
                syncStore: { value: this.syncStore?.bind(this), enumerable: false, writable: true, configurable: true },
                bsn: { value: this.bsn, enumerable: false, writable: true, configurable: true },
                context: { value: this.context, enumerable: false, writable: true, configurable: true }
            });
            
            return controller;
        });
        Object.entries(attrMap).forEach(([key, val]) => target.setAttribute(key, val));

        target.setAttribute('x-data', controllerName);
        target.setAttribute('x-cloak', '');
        target.innerHTML = template;
        
        await Alpine.nextTick();
        if (!target._x_dataStack) {
            globalThis.Alpine.initTree(target);
        }
        return target;
    }

    async stop(context) {
        this._trackers.forEach(t => { try { t.close(); } catch (_e) { /* Ignore */ } });
        this._effects.forEach(c => { try { c(); } catch (_e) { /* Ignore */ } });
        await super.stop(context);
    }
}
