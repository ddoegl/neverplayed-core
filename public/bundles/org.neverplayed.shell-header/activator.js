import { 
    REALM_SERVICE,
    REALM_MANAGER_SERVICE,
    CONFIG_ADMIN_UI_FLOW,
    SYSTEM_RESET_SERVICE,
    SESSION_SERVICE,
    STRATUM_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    AUTH_SHIELD_SERVICE,
    PERCEIVER_SERVICE,
    PERCEIVER_CHANGED_TOPIC,
    SHELL_UI_CONTEXT_PID,
    EVENT_HANDLER_INTERFACE
} from "core-types";
import { AlpineActivator } from "alpine-base";

/**
 * Shell Header Activator
 * Demonstrates the Alpine-Base pattern for reactive OSGi UI bundles.
 * Centrally manages the global UI context (Realms, User, Sidebar).
 */
export default class Activator extends AlpineActivator {
    constructor() {
        super();
        this._session = null;
        this._perceiver = null;
    }

    async onStart(context) {
        this.ctx = context;
        this.pm = null;
        const UI_STORAGE_PID = SHELL_UI_CONTEXT_PID;

        const mountPoint = this.config.mountPoint || "#shell-header";


        // 1. Initialize Global UI Context Store
        const store = this.initStore('shell_context', {
            activeRealm: { id: 'loading', title: 'Loading...', icon: 'fas fa-circle-notch fa-spin' },
            realms: [],
            inhabitants: [],
            sidebarOpen: true,
            sidebarState: 0, // 0: Expanded, 1: Icons, 2: Hidden
            perceiver: {
                being: null,
                surrogate: { grounding: 'idealist', senses: [] },
                realm: { id: 'unknown' },
                observerMode: 'idealist'
            }
        });

        // Track Perceiver Service (New Perceptual Source of Truth)
        this.track(`(objectClass=${PERCEIVER_SERVICE})`, {
            addingService: (ref) => {
                this._perceiver = context.getService(ref);
                this.syncStore('shell_context', { perceiver: this._perceiver.getContext() });
                return this._perceiver;
            },
            removedService: () => {
                this._perceiver = null;
            }
        });

        // Track Session Service
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                this._syncRealms();
                return this._session;
            },
            removedService: () => {
                this._session = null;
                this._syncRealms();
            }
        });

        // Listen for Perceiver Changes
        this.context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                if (this._perceiver) {
                    this.syncStore('shell_context', { perceiver: this._perceiver.getContext() });
                    this.logger?.debug(`[ShellHeader] Perceiver context synchronized.`);
                }
            }
        }, {
            "event.topics": [PERCEIVER_CHANGED_TOPIC]
        });

        // Track Persistence Manager for Gold Standard Persistence (Pattern 4)
        this.track(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(|(implementation=selector-proxy)(service.ranking>=1000)))`, {
            addingService: (ref) => {
                this.pm = context.getService(ref);
                this._restoreUIState(UI_STORAGE_PID, store);
                
                // Reactive sync to persistence
                this.effect(() => {
                    const data = {
                        sidebarOpen: store.sidebarOpen,
                        sidebarState: store.sidebarState,
                        lastRealmId: store.activeRealm?.id
                    };
                    this.pm.store(UI_STORAGE_PID, data);
                    this.logger?.debug(`[Persistence] UI State synchronized to PM:`, data);
                });
                return this.pm;
            }
        });

        // 2. Track Realm Services (Fully reactive via syncStore)
        this.track(`(objectClass=${REALM_SERVICE})`, {
            addingService: (ref) => { 
                this._syncRealms(); 
                return context.getService(ref); 
            },
            modifiedService: () => this._syncRealms(),
            removedService: () => this._syncRealms()
        });



        // 4. Render UI (Atomic & Guarded)
        const self = this;
        await this.render(mountPoint, 'templates/header.html', () => ({
            get shell() { return globalThis.Alpine.store('shell_context') || { realms: [], activeRealm: {}, user: { alias: 'Guest', avatar: '?' } }; },
            get activeFlow() { return globalThis.backofficeState?.activeFlow || globalThis.businessPortalState?.activeFlow; },
            
            toggleSidebar() {
                this.shell.sidebarState = (this.shell.sidebarState + 1) % 3;
            },

            async switchRealm(id) {
                try {
                    // Priority A: Orchestrated switch via Realm Manager
                    const rmRef = context.getServiceReference(REALM_MANAGER_SERVICE);
                    if (rmRef) {
                        await context.getService(rmRef).switchRealm(id);
                        return;
                    }
                    // Priority B: Direct fallback switch
                    const refs = (context.getServiceReferences(REALM_SERVICE) || []);
                    const target = refs.find(ref => ref.getProperty('realm.id') === id);
                    if (target) {
                        const svc = context.getService(target);
                        if (svc && typeof svc.switch === 'function') await svc.switch(true);
                    }
                } catch (err) {
                    this.logger?.warn(`[ShellHeader] Realm Switch Failed: ${err.message}`);
                    alert(`Switch Failed: ${err.message}`);
                }
            },
            
            async logout(scope = null) {
                console.log(`[ShellHeader] Logout requested for scope: ${scope}`);
                const stratum = globalThis.Alpine?.store('stratum');
                if (stratum) {
                    const targetScope = scope || stratum.realmId;
                    await stratum.logout(targetScope);
                    // Only reload on platonic logout (Operator Dissolution)
                    if (targetScope === 'platonic') {
                        location.reload();
                    }
                }
            },

            async login(id) {
                const stratum = globalThis.Alpine?.store('stratum');
                if (id && stratum) {
                    await stratum.login(id);
                }
            },

            async identityLogin() {
                const identity = prompt("Enter Identity ID (e.g. daniela-dev):");
                const stratum = globalThis.Alpine?.store('stratum');
                if (identity && stratum) {
                    await stratum.login(identity);
                }
            },

            goHome() {
                location.reload();
            },
            
            triggerReset() {
                const ref = context.getServiceReference(SYSTEM_RESET_SERVICE);
                if (ref) {
                    const svc = context.getService(ref);
                    if (typeof svc.factoryReset === 'function') {
                        svc.factoryReset();
                    } else if (typeof svc.reset === 'function') {
                        svc.reset();
                    }
                }
            },
            
            launchConfig() {
                globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: CONFIG_ADMIN_UI_FLOW } }));
            }
        }), {
            "class": "h-16 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-20 flex-shrink-0",
            "x-show": "!activeFlow?.hideNavigation"
        });
    }

    /**
     * _syncRealms
     * Maps available OSGi Realm Services to the Alpine Switcher.
     */
    _syncRealms() {
        // Diagnostic: Ground Truth
        const refs = this.context.getServiceReferences(REALM_SERVICE) || [];
        this.logger?.debug(`Header Diagnostic: Service Registry reports ${refs.length} realm services.`);
        
        // Build the raw list of IDs and their bundle sources
        const rawInfo = refs.map(ref => `[ID: ${ref.getProperty('realm.id')} (#${ref.getBundle().id})]`).join(', ');
        this.logger?.debug(`Header Diagnostic: Raw IDs: ${rawInfo}`);

        // Deduplicate
        const uniqueMap = new Map();
        for (const ref of refs) {
            const id = ref.getProperty('realm.id');
            if (id && !uniqueMap.has(id)) uniqueMap.set(id, ref);
        }
        
        const realms = Array.from(uniqueMap.values()).map(ref => ({
            id: ref.getProperty('realm.id'),
            title: ref.getProperty('realm.title') || 'Untitled',
            icon: ref.getProperty('realm.icon') || 'fas fa-universe',
            active: !!ref.getProperty('realm.active'),
            bundleId: ref.getBundle().id
        }));

        let activeRealm = realms.find(r => r.active) || realms[0] || { id: 'none', title: 'Loading...' };

        const activeRealmId = this._session?.activeRealmId;
        if (activeRealmId === 'platonic') {
            activeRealm = {
                id: 'platonic',
                title: 'Platonic Lobby',
                icon: 'fas fa-door-open',
                active: true
            };
        }

        this.syncStore('shell_context', {
            realms: JSON.parse(JSON.stringify(realms)), // Break proxy references
            activeRealm
        });
    }


    async _restoreUIState(pid, store) {
        if (!this.pm) return;
        try {
            const saved = await this.pm.load(pid);
            if (saved) {
                this.logger?.info(`[Persistence] Restoring UI State:`, saved);
                if (saved.sidebarOpen !== undefined) store.sidebarOpen = saved.sidebarOpen;
                if (saved.sidebarState !== undefined) store.sidebarState = saved.sidebarState;
            }
        } catch (err) {
            this.logger?.error(`[Persistence] Failed to restore UI context:`, err.message);
        }
    }
}
