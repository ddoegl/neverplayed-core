import { FLOW_SERVICE as _FLOW_SERVICE, LOG_SERVICE, CONFIG_ADMIN_SERVICE, PERSISTENCE_MANAGER_SERVICE, LIMES_SERVICE, AUTH_SHIELD_SERVICE, PLEXUS_ENGINE_SERVICE, SESSION_SERVICE } from "core-types";

/**
 * BaseActivator
 * Standardizes OSGi bundle lifecycle with auto-logging and auto-config.
 */
export class BaseActivator {
    constructor() {
        this.context = null;
        this.logger = console;
        this.config = {};
        this.persistence = null;
        this.bsn = "unknown";
        this.isHeadless = !!globalThis.Deno || !globalThis.document?.body;
    }

    async start(context) {
        this.context = context;
        const bundle = context.getBundle();
        this.bsn = bundle.getSymbolicName();
        
        // 1. Extract Static Config (Manifest)
        const headers = bundle.getHeaders();
        this.config = headers.Configuration || {};

        // 2. Merge Persistent Config (Config Admin)
        const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
        if (caRef) {
            const ca = context.getService(caRef);
            const persistentConfig = ca.getConfiguration(this.bsn).getProperties();
            if (persistentConfig) {
                this.config = { ...this.config, ...persistentConfig };
            }
        }

        // 3. Setup Persistence Manager
        const pmRef = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
                      
        if (pmRef) {

            this.persistence = context.getService(pmRef);
        } else {
            // Memory Fallback (Generic Support)
            // Ensures bundles don't crash before the storage bundle is ready
            const _memory = new Map();
            this.persistence = {
                load: (key) => _memory.get(key) || null,
                store: (key, val) => _memory.set(key, val)
            };
            this.logger.warn("PersistenceManager not found, using in-memory fallback.");
        }


        // 2. Setup Logger (Rule 19)
        const logRef = context.getServiceReference(LOG_SERVICE);
        if (logRef) {
            this.logger = context.getService(logRef).getLogger(this.bsn);
        }

        this.logger.info(`Activator: Starting ${this.bsn}...`);
        
        // 3. Optional Auto-Flow Registration (Pattern: Configuration header contains flow info)
        if (this.config.sidebar || this.config.flowId) {
            this.registerAutoFlow();
        }

        // 4. Lifecycle Hook
        await this.onStart(context);
    }

    async stop(context) {
        await this.onStop(context);
        this.logger.info(`Activator: Stopped ${this.bsn}`);
    }

    /**
     * Optional Lifecycle Hooks for Subclasses
     */
    async onStart(_context) {
        // To be implemented by subclasses
    }

    async onStop(_context) {
        // To be implemented by subclasses
    }

    /**
     * Default Flow Registration based on Manifest/Config
     */
    registerAutoFlow() {
        // This is a hook for sub-classes to easily register themselves if they match a pattern
        // Usually, complex UI flows will override onStart and do manual registration,
        // but simple ones can use this.
    }
}

/**
 * CoreActivator
 * Hardened activator with native Limes and AuthShield integration.
 */
export class CoreActivator extends BaseActivator {
    constructor() {
        super();
        this.limes = null;
        this.authShield = null;
    }

    async onStart(context) {
        // 1. Track Limes
        context.trackService(`(objectClass=${LIMES_SERVICE})`, {
            addingService: (ref) => {
                this.limes = context.getService(ref);
                // Declarative Strategy Registration
                if (this.config.limesStrategies) {
                    this.config.limesStrategies.forEach(s => this.limes.registerStrategy(s.id, s.definition));
                }
            },
            removedService: () => { this.limes = null; }
        }).open();

        // 2. Track AuthShield
        context.trackService(`(objectClass=${AUTH_SHIELD_SERVICE})`, {
            addingService: (ref) => { this.authShield = context.getService(ref); },
            removedService: () => { this.authShield = null; }
        }).open();

        await this.onCoreStart(context);
    }

    isAllowed(strategyId, runtimeContext = {}) {
        if (!this.limes) return false;
        const user = this.authShield?.getCurrentUser();
        return this.limes.isAllowed(user, strategyId, runtimeContext);
    }

    async onCoreStart(_context) {
        // To be implemented by subclasses
    }
}

/**
 * DomainActivator
 * Persona-aware activator for application domain logic.
 */
export class DomainActivator extends CoreActivator {
    constructor() {
        super();
        this.plexus = null;
        this.session = null;
    }

    async onCoreStart(context) {
        // 1. Track Plexus
        context.trackService(`(objectClass=${PLEXUS_ENGINE_SERVICE})`, {
            addingService: (ref) => { this.plexus = context.getService(ref); },
            removedService: () => { this.plexus = null; }
        }).open();

        // 2. Track Session
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => { this.session = context.getService(ref); },
            removedService: () => { this.session = null; }
        }).open();

        await this.onDomainStart(context);
    }

    async onDomainStart(_context) {
        // To be implemented by subclasses
    }
}

