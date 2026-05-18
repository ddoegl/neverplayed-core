import { 
    PERCEIVER_SERVICE, 
    LOG_SERVICE, 
    EVENT_ADMIN_SERVICE, 
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    PERCEIVER_CHANGED_TOPIC,
    REALM_CHANGED_TOPIC,
    SESSION_SERVICE,
    REALM_MANAGER_SERVICE,
    KNOWLEDGE_PROVIDER_SERVICE
} from "core-types";
import { BaseActivator } from "osgi-base";

/**
 * Perceiver Service Activator
 * 
 * Acts as the central oracle for surrogate perception state.
 * Bridges disparate event sources (DOM session-changed, OSGi realm-changed) 
 * into a unified Perception Context.
 */
export default class Activator extends BaseActivator {
    _state = {
        being: null,
        surrogate: { grounding: "idealist", senses: [] },
        realm: "org.neverplayed.realm.core",
        observerMode: "idealist" 
    };

    _eventAdmin = null;
    _eventFactory = null;
    _perceiverReg = null;
    _providers = new Set();

    onStart(context) {
        // 1. Logger
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger(this.bsn);
                this.logger.info("Perceiver Service: Activated.");
                return svc;
            }
        });
        this._logTracker.open();

        // 2. Event Trackers
        this._eaTracker = context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => { 
                this._eventAdmin = context.getService(ref); 
                this.notify();
                return this._eventAdmin; 
            },
            removedService: () => { this._eventAdmin = null; }
        });
        this._eaTracker.open();

        this._efTracker = context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => { 
                this._eventFactory = context.getService(ref); 
                return this._eventFactory; 
            },
            removedService: () => { this._eventFactory = null; }
        });
        this._efTracker.open();

        // 3. Track Session & Realm for Initial Sync
        this._sessionTracker = context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                const session = context.getService(ref);
                this._syncFromSession(session);
                return session;
            }
        });
        this._sessionTracker.open();

        this._realmTracker = context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                const realmManager = context.getService(ref);
                this._syncFromRealmManager(realmManager);
                return realmManager;
            }
        });
        this._realmTracker.open();

        // Track Knowledge Providers for Dynamic Senses
        this._kpTracker = context.trackService(`(objectClass=${KNOWLEDGE_PROVIDER_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this._providers.add(svc);
                this.notify(); // Re-notify on new senses
                return svc;
            },
            removedService: (ref) => {
                const svc = context.getService(ref);
                if (svc) this._providers.delete(svc);
                this.notify();
            }
        });
        this._kpTracker.open();

        // 4. Listen for Real-time Shifts
        // 4a. OSGi Realm Changes
        this._realmHandlerReg = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const realmId = event.getProperty("realm.id");
                if (realmId) {
                    this.setContext({ realm: realmId });
                }
            }
        }, { [EVENT_TOPIC]: [REALM_CHANGED_TOPIC] });

        // 4b. DOM Session Changes (Bridge)
        this._onSessionChanged = (e) => {
            if (e.detail && e.detail.type === 'login') {
                const user = e.detail.user;
                const surrogate = e.detail.surrogate;
                this.setContext({ 
                    being: user, 
                    surrogate: surrogate || this._state.surrogate 
                });
            } else if (e.detail && e.detail.type === 'logout') {
                this.setContext({ being: null });
            }
        };
        globalThis.addEventListener('session-changed', this._onSessionChanged);

        // 5. Register Service
        this._perceiverReg = context.registerService(PERCEIVER_SERVICE, {
            getBeing: () => this._state.being,
            getSurrogate: () => this._state.surrogate,
            getRealm: () => this._state.realm,
            getObserverMode: () => this._state.observerMode,
            getContext: () => ({ ...this._state }),
            setContext: (patch) => this.setContext(patch),
            getEnrichedSenses: () => {
                const ctx = {
                    ...this._state,
                    surrogate: JSON.parse(JSON.stringify(this._state.surrogate || { senses: [] }))
                };
                if (!ctx.surrogate.senses) ctx.surrogate.senses = [];
                for (const provider of this._providers) {
                    if (typeof provider.enrich === 'function') {
                        try {
                            provider.enrich(ctx);
                        } catch (err) {
                            this.logger?.warn("Perceiver: Provider enrich failed", err);
                        }
                    }
                }
                return ctx.surrogate.senses;
            }
        });

        // 6. Register Default Grounding Provider
        this._groundingProviderReg = context.registerService(KNOWLEDGE_PROVIDER_SERVICE, {
            enrich: (ctx) => {
                if (!ctx.surrogate) return;
                if (!ctx.surrogate.senses) ctx.surrogate.senses = [];
                const mode = ctx.surrogate.grounding || ctx.observerMode || "idealist";
                const inject = (sense) => { if (!ctx.surrogate.senses.includes(sense)) ctx.surrogate.senses.push(sense); };
                if (mode === "realist") {
                    inject("IdealistVision");
                    inject("ForensicVision");
                    inject("ArchitectControl");
                } else {
                    inject("IdealistVision");
                }
            }
        });
    }

    _syncFromSession(session) {
        if (!session) return;
        const user = session.currentUser;
        if (user) {
            const surrogate = user.activeSurrogateId ? (user.surrogates?.[user.activeSurrogateId] || null) : null;
            this.setContext({ 
                being: user.id !== 'guest' ? user : null,
                surrogate: surrogate || (user.id === 'guest' ? { grounding: 'idealist', senses: [] } : this._state.surrogate)
            });
        }
    }

    _syncFromRealmManager(realmManager) {
        if (!realmManager) return;
        const activeRealm = realmManager.getActiveRealm();
        if (activeRealm) {
            this.setContext({ realm: activeRealm });
        }
    }

    setContext(patch) {
        const old = { ...this._state };
        
        // Rule: Level-to-Mode Mapping (SDN-0205)
        // Advanced level implies 'Realist' mode (total view of the universe).
        // Beginner level implies 'Idealist' mode (view through the being's senses).
        if (patch.surrogate && patch.surrogate.grounding) {
            patch.observerMode = patch.surrogate.grounding;
        }

        this._state = { ...this._state, ...patch };
        
        // Deep compare (simple JSON)
        if (JSON.stringify(old) !== JSON.stringify(this._state)) {
            this.logger?.info("Perceiver Context Shift:", this._state);
            this.notify();
        }
    }

    onStop() {
        if (this._logTracker) this._logTracker.close();
        if (this._eaTracker) this._eaTracker.close();
        if (this._efTracker) this._efTracker.close();
        if (this._sessionTracker) this._sessionTracker.close();
        if (this._realmTracker) this._realmTracker.close();
        if (this._kpTracker) this._kpTracker.close();
        if (this._realmHandlerReg) this._realmHandlerReg.unregister();
        if (this._perceiverReg) this._perceiverReg.unregister();
        if (this._groundingProviderReg) this._groundingProviderReg.unregister();
        globalThis.removeEventListener('session-changed', this._onSessionChanged);
    }

    notify() {
        if (!this._eventAdmin || !this._eventFactory) {
            // Deferred notification until Event services are available
            return;
        }

        try {
            const event = this._eventFactory.build(PERCEIVER_CHANGED_TOPIC, {
                "perceiver.being": this._state.being,
                "perceiver.surrogate": this._state.surrogate,
                "perceiver.realm": this._state.realm,
                "perceiver.observerMode": this._state.observerMode,
                "timestamp": Date.now()
            });
            this._eventAdmin.postEvent(event);
        } catch (err) {
            this.logger?.error("Perceiver: Notification failed:", err.message);
        }
    }
}
