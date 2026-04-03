import { 
    REALM_MANAGER_SERVICE,
    CONFIG_ADMIN_UI_FLOW,
    SYSTEM_RESET_SERVICE,
    LOG_SERVICE,
    REALM_CHANGED_TOPIC, 
    REALM_REGISTERED_TOPIC,
    REALM_UNREGISTERED_TOPIC,
    EVENT_HANDLER_INTERFACE, 
    EVENT_TOPIC, 
    SESSION_SERVICE 
} from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    constructor() {
        super();
        this._realmManager = null;
        this._eventAdmin = null;
        this._session = null;
        this._handlerReg = null;
        this._isStopped = false;
    }

    async onStart(context) {
        // 1. Initialize Logger
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("org.neverplayed.shell-header");
                return svc;
            }
        });
        this._logTracker.open();

        // 2. Track Realm Manager for initial state
        this._realmTracker = context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: async (ref) => {
                const rm = context.getService(ref);
                this._realmManager = rm;
                // Wait for manager to recover state before initial hydration
                await rm.waitReady();
                this._updateActiveRealm();
                return rm;
            },
            removedService: () => { this._realmManager = null; }
        });
        this._realmTracker.open();

        // 3. Track Session for User Info
        this._sessionTracker = context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                this._updateSession();
                return this._session;
            },
            removedService: () => { this._session = null; }
        });
        this._sessionTracker.open();

        // 4. Register Event Handler for Realm Transitions
        this._handlerReg = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                if (this._isStopped) return;
                const topic = event.getTopic();
                const realmId = event.getProperty("realm.id");
                
                this.logger.info(`[Header] Event received on topic: ${topic} for Realm: ${realmId}`);
                
                if (topic === REALM_CHANGED_TOPIC) {
                    this._updateActiveRealm(realmId);
                } else {
                    // Registration/Unregistration: Just refresh the list
                    this._updateActiveRealm();
                }
            }
        }, {
            [EVENT_TOPIC]: [REALM_CHANGED_TOPIC, REALM_REGISTERED_TOPIC, REALM_UNREGISTERED_TOPIC]
        });
        this.logger.info(`[Header] EventHandler registered for topics: ${REALM_CHANGED_TOPIC}, ${REALM_REGISTERED_TOPIC}`);

        // 5. Initialize UI
        await this._initUI();
    }

    async _initUI() {
        if (this._isStopped) return;

        // Ensure Alpine Store exists (Dedicated namespace for Context/Realm state)
        if (!globalThis.Alpine.store('shell_context')) {
            globalThis.Alpine.store('shell_context', {
                activeRealm: { id: 'loading', title: 'Loading...', icon: 'fas fa-circle-notch fa-spin' },
                realms: [],
                user: { alias: 'Guest', avatar: '?' },
                sidebarOpen: true
            });
        }

        // Initial hydration
        this._updateActiveRealm();
        this._updateSession();

        const target = document.getElementById('shell-header');
        if (!target) return;

        const templatePath = this.resolveResource("templates/header.html");
        const template = await (await fetch(templatePath)).text();
        
        target.innerHTML = `<div x-data="headerController">${template}</div>`;

        globalThis.Alpine.data('headerController', () => ({
            get shell() { return globalThis.Alpine.store('shell_context'); },
            get activeFlow() { return globalThis.backofficeState?.activeFlow || globalThis.businessPortalState?.activeFlow; },
            
            toggleSidebar() {
                this.shell.sidebarOpen = !this.shell.sidebarOpen;
                // Traditional event for remaining index.html logic
                globalThis.dispatchEvent(new CustomEvent('shell-header:sidebar-toggle'));
            },

            async switchRealm(id) {
                const rmRef = this.context.getServiceReference(REALM_MANAGER_SERVICE);
                const rm = rmRef ? this.context.getService(rmRef) : null;
                if (rm) {
                    await rm.switchRealm(id, true);
                }
            },
            
            async logout() {
                const sessionRef = this.context.getServiceReference(SESSION_SERVICE);
                const sessionSvc = sessionRef ? this.context.getService(sessionRef) : null;
                if (sessionSvc) {
                    await sessionSvc.logout();
                }
                location.reload();
            },

            goHome() {
                location.reload();
            },
            
            triggerReset() {
                const resetRef = this.context.getServiceReference(SYSTEM_RESET_SERVICE);
                const resetSvc = resetRef ? this.context.getService(resetRef) : null;
                if (resetSvc) resetSvc.reset();
            },
            
            launchConfig() {
                globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: CONFIG_ADMIN_UI_FLOW } }));
            }
        }));

        await globalThis.Alpine.nextTick();
        globalThis.Alpine.initTree(target);
    }

    _updateActiveRealm(manualId) {
        if (this._isStopped) return;
        const store = globalThis.Alpine.store('shell_context');
        if (!store) return;

        const id = manualId || this._realmManager?.getActiveRealm() || 'none';
        const realms = this._realmManager?.getRealms() || [];
        const manifest = realms.find(r => r.id === id);

        store.activeRealm = {
            id,
            title: manifest?.title || id,
            icon: manifest?.icon || (id === 'none' ? 'fas fa-ghost' : 'fas fa-universe')
        };
        
        // Update list of realms for the switcher
        store.realms = realms.map(r => ({
            id: r.id,
            title: r.title,
            icon: r.icon || "fas fa-universe"
        }));
    }

    _updateSession() {
        if (this._isStopped) return;
        const store = globalThis.Alpine.store('shell_context');
        if (!store || !this._session) return;

        const user = this._session.currentUser;
        store.user = {
            alias: typeof user === 'object' ? (user.alias || user.firstname || 'User') : (user || 'Guest'),
            avatar: (typeof user === 'object' ? (user.alias || user.firstname || '?') : (user || '?')).charAt(0).toUpperCase()
        };
    }

    onStop() {
        this._isStopped = true;
        if (this._handlerReg) this._handlerReg.unregister();
        if (this._logTracker) this._logTracker.close();
        if (this._realmTracker) this._realmTracker.close();
        if (this._sessionTracker) this._sessionTracker.close();
    }
}
