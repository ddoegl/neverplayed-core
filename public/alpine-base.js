import { BaseActivator } from "osgi-base";
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
    track(sid, options) {
        if (!this.context) {
            throw new Error("[AlpineActivator] Cannot track service before start(). Call track() inside onStart().");
        }
        const tracker = this.context.trackService(sid, options);
        this._trackers.push(tracker);
        tracker.open();
        return tracker;
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
        const sanitizedBsn = (this.bsn || "unknown").replace(/[\.\-]/g, "_");
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
        Alpine.data(controllerName, (...args) => controllerFactory.apply(this, args));

        // Apply Attributes
        Object.entries(attrMap).forEach(([key, val]) => target.setAttribute(key, val));

        // Inject and Boot
        target.setAttribute('x-data', controllerName);
        target.setAttribute('x-cloak', '');
        target.innerHTML = template;
        
        // Ensure Alpine parses the new DOM
        await Alpine.nextTick();
        Alpine.initTree(target);
        
        this.logger?.info(`[Alpine] UI Component '${controllerName}' mounted on '${targetSelector}'`);
        return target;
    }

    async stop(context) {
        // 1. Close all tracked services
        this._trackers.forEach(t => {
            try { t.close(); } catch (_e) { /* ignore */ }
        });
        
        // 2. Stop all effects
        this._effects.forEach(cleanup => {
            try { cleanup(); } catch (_e) { /* ignore */ }
        });

        // 3. Standard lifecycle
        await super.stop(context);
    }
}
