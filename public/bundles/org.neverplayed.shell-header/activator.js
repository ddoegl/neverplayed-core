import { 
    REALM_SERVICE,
    REALM_MANAGER_SERVICE,
    CONFIG_ADMIN_UI_FLOW,
    SYSTEM_RESET_SERVICE,
    LOG_SERVICE, 
    SESSION_SERVICE 
} from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    constructor() {
        super();
        this._session = null;
        this._isStopped = false;
        this._realms = new Map(); // id -> metadata
    }

    async onStart(context) {
        // 1. Initialize Logger
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("org.neverplayed.shell-header");
                this.logger.info(`[Header] Logger initialized.`);
                return svc;
            }
        });
        this._logTracker.open();

        // 2. Track Realm Services (Resilient Filter Pattern)
        const realmFilter = `(objectClass=${REALM_SERVICE})`;
        this._realmTracker = context.trackService(realmFilter, {
            addingService: (ref) => {
                const id = ref.getProperty("realm.id");
                const title = ref.getProperty("realm.title");
                const active = ref.getProperty("realm.active");
                const provider = ref.getBundle()?.getSymbolicName() || "Unknown";

                console.log(`[Header] Realm Service Discovered: ID=[${id}] Title=[${title}] from Bundle=[${provider}] (Active: ${active})`);
                
                if (this._realms.has(id)) {
                    console.warn(`[Header] COLLISION DETECTED for realm [${id}]. Overwriting old registration from ${this._realms.get(id).provider || 'Unknown'}`);
                }

                this.logger?.info(`[Header] Tracker found Realm: ${id} (Active: ${active})`);
                this._processServiceArrival(ref, id, title, active, provider);
                return context.getService(ref);
            },
            modifiedService: (ref) => {
                const id = ref.getProperty("realm.id");
                const active = ref.getProperty("realm.active");
                this.logger?.info(`[Header] Tracker received Update: ${id} (Active: ${active})`);
                this._processServiceUpdate(ref, id, active);
            },
            removedService: (ref) => {
                const id = ref.getProperty("realm.id");
                this._realms.delete(id);
                this._syncStore();
            }
        });
        this._realmTracker.open();

        // 2.2 Deep Scan Diagnostic (Bypass Tracker)
        setTimeout(() => {
            const allRefs = context.getServiceReferences(null, null) || [];
            console.log(`[Header] Deep Scan: Total Services in Registry: ${allRefs.length}`);
            const matches = allRefs.filter(ref => {
                const oc = ref.getProperty("objectClass");
                const names = Array.isArray(oc) ? oc : [oc];
                return names.includes(REALM_SERVICE);
            });
            
            if (matches.length > 0) {
                console.log(`[Header] Deep Scan found ${matches.length} matches for ${REALM_SERVICE}`);
                matches.forEach(ref => {
                    const id = ref.getProperty("realm.id");
                    if (!this._realms.has(id)) {
                        console.log(`[Header] Deep Scan DISCOVERED MISSING SERVICE: ${id}`);
                        this._processServiceArrival(ref, id, ref.getProperty("realm.title"), ref.getProperty("realm.active"), "DeepScan");
                    }
                });
            } else {
                console.warn(`[Header] Deep Scan found ZERO matches for ${REALM_SERVICE}. Registry check failed.`);
            }
        }, 2000);

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

        // 5. Initialize UI
        await this._initUI();
    }

    async _initUI() {
        if (this._isStopped) return;
        const realmsMap = this._realms;
        const ctx = this.context;

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
        this._syncStore();
        this._updateSession();

        const target = document.getElementById('shell-header');
        if (!target) return;

        // Guard: Prevent double-initialization if the bundle is started twice (e.g. bootstrapper + manifest)
        if (target.dataset.shellHeaderInitialized === 'true') {
            console.log('[Header] Shell Header already initialized on this DOM target. Skipping second injection.');
            // Still sync the store to ensure current instance state is reflected
            this._syncStore();
            return;
        }
        target.dataset.shellHeaderInitialized = 'true';

        const templatePath = this.resolveResource("templates/header.html");
        const template = await (await fetch(templatePath)).text();
        
        target.innerHTML = `<div x-data="headerController">${template}</div>`;

        globalThis.Alpine.data('headerController', () => ({
            get shell() { return globalThis.Alpine.store('shell_context'); },
            get activeFlow() { return globalThis.backofficeState?.activeFlow || globalThis.businessPortalState?.activeFlow; },
            
            toggleSidebar() {
                this.shell.sidebarOpen = !this.shell.sidebarOpen;
                globalThis.dispatchEvent(new CustomEvent('shell-header:sidebar-toggle'));
            },

            async switchRealm(id) {
                console.log(`[Header] Switching to realm: ${id}`);
                
                // Strategy A: Use the Manager (Preferred for orchestrated flows)
                const rmRef = ctx.getServiceReference(REALM_MANAGER_SERVICE);
                if (rmRef) {
                    const rm = ctx.getService(rmRef);
                    try {
                        await rm.switchRealm(id, false);
                        return;
                    } catch (e) {
                        console.warn(`[Header] Manager switch failed, attempting fallback: ${e.message}`);
                    }
                }

                // Strategy B: Use the specific Realm Service fallback
                const entry = realmsMap.get(id);
                if (entry) {
                    const svc = ctx.getService(entry.ref);
                    if (svc) await svc.switch(true);
                } else {
                    console.error(`[Header] Cannot switch: Realm ${id} not found in local map.`);
                }
            },
            
            async logout() {
                const sessionRef = ctx.getServiceReference(SESSION_SERVICE);
                const sessionSvc = sessionRef ? ctx.getService(sessionRef) : null;
                if (sessionSvc) await sessionSvc.logout();
                location.reload();
            },

            goHome() {
                location.reload();
            },
            
            triggerReset() {
                const resetRef = ctx.getServiceReference(SYSTEM_RESET_SERVICE);
                const resetSvc = resetRef ? ctx.getService(resetRef) : null;
                if (resetSvc) resetSvc.reset();
            },
            
            launchConfig() {
                globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: CONFIG_ADMIN_UI_FLOW } }));
            }
        }));

        await globalThis.Alpine.nextTick();
        globalThis.Alpine.initTree(target);
    }

    _processServiceArrival(ref, id, title, active, provider) {
        this._realms.set(id, { 
            id, 
            title, 
            icon: ref.getProperty("realm.icon") || "fas fa-universe", 
            active: !!active, 
            ref,
            provider
        });
        this._syncStore();
    }

    _processServiceUpdate(ref, id, active) {
        const current = this._realms.get(id);
        if (current) {
            current.active = !!active;
            current.title = ref.getProperty("realm.title") || current.title;
            current.icon = ref.getProperty("realm.icon") || current.icon;
            this._syncStore();
        }
    }

    _syncStore() {
        if (this._isStopped) return;
        const store = globalThis.Alpine.store('shell_context');
        if (!store) return;

        // Deduplicate: If multiple services report the same ID (e.g. from races or duplicate registrations), keep only the first
        const allRealmsRaw = Array.from(this._realms.values());
        const uniqueRealms = [];
        const seenIds = new Set();

        for (const r of allRealmsRaw) {
            const id = (r.id || "").trim();
            if (id && !seenIds.has(id)) {
                uniqueRealms.push(r);
                seenIds.add(id);
            }
        }

        let active = uniqueRealms.find(r => r.active);
        
        // Rule 8: Resilient Fallback - Query Manager if active flag not yet propagated
        if (!active && uniqueRealms.length > 0) {
            const rmRef = this.context.getServiceReference(REALM_MANAGER_SERVICE);
            if (rmRef) {
                const rm = this.context.getService(rmRef);
                const activeId = rm.getActiveRealm();
                active = uniqueRealms.find(r => r.id === activeId);
            }
        }

        const activeDisplay = active || { id: 'none', title: 'Unknown Layer', icon: 'fas fa-ghost' };
        
        console.log(`[Header] Syncing Store. Unique: ${uniqueRealms.length} | IDs: [${uniqueRealms.map(r => r.id).join(', ')}] | Active: ${activeDisplay.id}`);

        store.activeRealm = {
            id: activeDisplay.id,
            title: activeDisplay.title,
            icon: activeDisplay.icon
        };
        
        store.realms = uniqueRealms.map(r => ({
            id: r.id,
            title: r.title,
            icon: r.icon,
            active: r.active === true || activeDisplay.id === r.id
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
        if (this._logTracker) this._logTracker.close();
        if (this._realmTracker) this._realmTracker.close();
        if (this._sessionTracker) this._sessionTracker.close();
    }
}
