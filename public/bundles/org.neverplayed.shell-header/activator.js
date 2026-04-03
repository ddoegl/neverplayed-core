import { 
    REALM_SERVICE,
    REALM_MANAGER_SERVICE,
    CONFIG_ADMIN_UI_FLOW,
    SYSTEM_RESET_SERVICE,
    SESSION_SERVICE 
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
        // 1. Initialize Global UI Context Store
        this.initStore('shell_context', {
            activeRealm: { id: 'loading', title: 'Loading...', icon: 'fas fa-circle-notch fa-spin' },
            realms: [],
            user: { alias: 'Guest', avatar: '?' },
            sidebarOpen: true
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
                this._updateSession();
                return this._session;
            },
            removedService: () => { 
                this._session = null;
                this._updateSession();
            }
        });

        // 4. Render UI (Atomic & Guarded)
        await this.render('#shell-header', 'templates/header.html', () => ({
            get shell() { return globalThis.Alpine.store('shell_context'); },
            get activeFlow() { return globalThis.backofficeState?.activeFlow || globalThis.businessPortalState?.activeFlow; },
            
            toggleSidebar() {
                this.shell.sidebarOpen = !this.shell.sidebarOpen;
                globalThis.dispatchEvent(new CustomEvent('shell-header:sidebar-toggle'));
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
                if (ref) context.getService(ref).reset();
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
        const refs = this.context.getServiceReferences(REALM_SERVICE) || [];
        
        // Deduplicate by realm.id (Prevent duplicates from race conditions)
        const unique = Array.from(new Map(refs.map(ref => [ref.getProperty('realm.id'), ref])).values());
        
        // Handle Active State
        const activeRef = unique.find(ref => ref.getProperty('realm.active')) || unique[0];
        
        this.syncStore('shell_context', {
            realms: unique.map(ref => ({
                id: ref.getProperty('realm.id'),
                title: ref.getProperty('realm.title'),
                icon: ref.getProperty('realm.icon') || 'fas fa-universe',
                active: !!ref.getProperty('realm.active')
            })),
            activeRealm: activeRef ? {
                id: activeRef.getProperty('realm.id'),
                title: activeRef.getProperty('realm.title'),
                icon: activeRef.getProperty('realm.icon') || 'fas fa-universe'
            } : { id: 'none', title: 'Unknown Layer', icon: 'fas fa-ghost' }
        });
    }

    /**
     * _updateSession
     * Maps the OSGi Session to the Alpine UI profile.
     */
    _updateSession() {
        const user = this._session?.currentUser || null;
        this.syncStore('shell_context', {
            user: {
                alias: typeof user === 'object' ? (user?.alias || user?.firstname || 'User') : (user || 'Guest'),
                avatar: (typeof user === 'object' ? (user?.alias || user?.firstname || '?') : (user || '?')).charAt(0).toUpperCase()
            }
        });
    }
}
