import { 
    REALM_SERVICE,
    REALM_MANAGER_SERVICE,
    CONFIG_ADMIN_UI_FLOW,
    SYSTEM_RESET_SERVICE,
    SESSION_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    AUTH_SHIELD_SERVICE
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
    }

    async onStart(context) {
        this.ctx = context;
        this.pm = null;
        const UI_STORAGE_PID = "org.neverplayed.shell.ui.context";

        // 1. Initialize Global UI Context Store
        const store = this.initStore('shell_context', {
            activeRealm: { id: 'loading', title: 'Loading...', icon: 'fas fa-circle-notch fa-spin' },
            realms: [],
            user: { alias: 'Guest', avatar: '?' },
            globalUser: null,
            sidebarOpen: true,
            sidebarState: 0 // 0: Expanded, 1: Icons, 2: Hidden
        });

        // Track Persistence Manager for Gold Standard Persistence (Pattern 4)
        this.track(`(objectClass=${PERSISTENCE_MANAGER_SERVICE})`, {
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

        // 3. Track Session (User Identity)
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                
                // Gold Standard Reactivity: Track the reactive session properties
                this.effect(() => {
                    if (this._session) {
                        this._updateSession();
                    }
                });
                return this._session;
            },
            removedService: () => { 
                this._session = null;
                this._updateSession();
            }
        });

        // 3.2 Track Auth Shield (Global Identity)
        this.track(`(objectClass=${AUTH_SHIELD_SERVICE})`, {
            addingService: (ref) => {
                const auth = context.getService(ref);
                const gUser = auth.getCurrentUser ? auth.getCurrentUser() : null;
                this.syncStore('shell_context', { globalUser: gUser });
                return auth;
            },
            removedService: () => {
                this.syncStore('shell_context', { globalUser: null });
            }
        });

        // 4. Render UI (Atomic & Guarded)
        await this.render('#shell-header', 'templates/header.html', () => ({
            get shell() { return globalThis.Alpine.store('shell_context') || { realms: [], activeRealm: {}, user: { alias: 'Guest', avatar: '?' } }; },
            get activeFlow() { return globalThis.backofficeState?.activeFlow || globalThis.businessPortalState?.activeFlow; },
            
            toggleSidebar() {
                this.shell.sidebarOpen = !this.shell.sidebarOpen;
                globalThis.dispatchEvent(new CustomEvent('shell:sidebar-toggle', { detail: { open: this.shell.sidebarOpen } }));
            },

            async switchRealm(id) {
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
            },
            
            async logout() {
                if (this._session) await this._session.logout();
                location.reload();
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

        this.syncStore('shell_context', {
            realms: JSON.parse(JSON.stringify(realms)), // Break proxy references
            activeRealm: realms.find(r => r.active) || realms[0] || { id: 'none', title: 'Loading...' }
        });
    }

    _updateSession() {
        if (this._session) {
            const user = this._session.currentUser;
            const isGuest = !user || user.id === 'guest';
            this.logger?.info(`[Header] Sync: id='${user?.id}', email='${user?.email}', isGuest=${isGuest}`);
            this.syncStore('shell_context', {
                user: { 
                    alias: isGuest ? 'Guest' : (user.alias || user.email || 'Explorer'), 
                    avatar: (isGuest ? 'G' : (user.alias || user.email || 'E'))[0].toUpperCase()
                }
            });
        } else {
            this.syncStore('shell_context', {
                user: { alias: 'Guest', avatar: '?' }
            });
        }
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
