import { 
    REALM_COGNITION_SERVICE, 
    SESSION_SERVICE, 
    EVENT_HANDLER_INTERFACE, 
    EVENT_TOPIC 
} from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _session = null;
    _cognition = null;
    _hasUserLoggedIn = false;
    _homeostasisListener = null;
    _sessionListener = null;

    async onStart(context) {
        this._hasUserLoggedIn = false;

        // Register homeostasis listener
        this._homeostasisListener = () => {
            this._updateReifications();
        };
        globalThis.addEventListener("core-realm-homeostasis-completed", this._homeostasisListener);

        // Listen to global session-changed event (translated by session-service-dom)
        this._sessionListener = (event) => {
            const detail = event.detail || {};
            if (detail.type === "login" && detail.user && detail.user.id !== "guest") {
                this._hasUserLoggedIn = true;
                this._updateReifications();
            } else if (detail.type === "logout") {
                this._updateReifications();
            }
        };
        globalThis.addEventListener("session-changed", this._sessionListener);

        // 1. Track Session Service
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                this._checkInitialUserState();
                this._updateReifications();
                return this._session;
            },
            removedService: () => {
                this._session = null;
                this._updateReifications();
            }
        });

        // 2. Track RealmCognitionService for core realm
        this.track(`(&(objectClass=${REALM_COGNITION_SERVICE})(realm.id=org.neverplayed.realm.core))`, {
            addingService: (ref) => {
                this._cognition = context.getService(ref);
                this._updateReifications();
                return this._cognition;
            },
            removedService: () => {
                this._cognition = null;
                this._updateReifications();
            }
        });

        // 3. Register Event Handler for session, realm, persistence and stratum change topics
        const topics = [
            "org/neverplayed/session/CHANGED",
            "org/neverplayed/realm/CHANGED",
            "org/neverplayed/persistence/CONTEXT_CHANGED",
            "org/neverplayed/persistence/CHANGED",
            "org/neverplayed/stratum/CHANGED"
        ];

        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const type = event.getProperty("type");
                const user = event.getProperty("user");
                if (type === "login" && user && user.id !== "guest") {
                    this._hasUserLoggedIn = true;
                }
                // Defer to make sure homeostasis step in core realm has updated _reifiedPids
                queueMicrotask(() => this._updateReifications());
            }
        }, { [EVENT_TOPIC]: topics });

        // 4. Register DOM adapter service itself
        context.registerService("org.neverplayed.realm.RealmDOMAdapter", this);

        this.logger.info("Realm Core DOM Adapter: Active. 🚀");
    }

    _checkInitialUserState() {
        if (this._session) {
            const currentUser = this._session.currentUser;
            if (currentUser && currentUser.id !== "guest" && currentUser.loggedIn !== false) {
                this._hasUserLoggedIn = true;
            }
        }
    }

    _updateReifications() {
        if (typeof globalThis.document === 'undefined') return;

        const activeRealmId = this._session?.activeRealmId;
        const isCoreActive = activeRealmId === "org.neverplayed.realm.core";
        const currentUser = this._session?.currentUser;
        
        const hasActiveLoggedInUser = currentUser && currentUser.id !== "guest" && currentUser.loggedIn !== false;
        
        const shouldMount = isCoreActive && (!this._hasUserLoggedIn || hasActiveLoggedInUser);
        const cognitionService = this._cognition;

        if (!shouldMount || !cognitionService) {
            // Clean up
            const container = globalThis.document.getElementById("core-realm-reifications");
            if (container) {
                this.logger.info("Realm Core DOM Adapter: Core realm inactive, user logged out, or cognition offline. Removing DOM reifications.");
                container.remove();
            }
            return;
        }

        const pids = cognitionService.getReifiedPids() || [];
        let container = globalThis.document.getElementById("core-realm-reifications");
        if (!container) {
            container = globalThis.document.createElement("div");
            container.id = "core-realm-reifications";
            container.style.position = "absolute";
            container.style.zIndex = "-1000";
            container.style.opacity = "0";
            container.style.pointerEvents = "none";
            globalThis.document.body.appendChild(container);
            this.logger.info("Realm Core DOM Adapter: Created #core-realm-reifications container.");
        }

        container.innerHTML = "";
        for (const pid of pids) {
            const el = globalThis.document.createElement("div");
            el.id = `reified-${pid}`;
            el.setAttribute("data-mark", JSON.stringify([{ type: "matchSense", value: "Language" }]));
            el.innerText = `Reified Component: ${pid}`;
            container.appendChild(el);
        }
        this.logger.debug(`Realm Core DOM Adapter: Reified ${pids.length} components.`);
    }

    onStop() {
        if (this._homeostasisListener) {
            globalThis.removeEventListener("core-realm-homeostasis-completed", this._homeostasisListener);
        }
        if (this._sessionListener) {
            globalThis.removeEventListener("session-changed", this._sessionListener);
        }
        if (typeof globalThis.document !== 'undefined') {
            const container = globalThis.document.getElementById("core-realm-reifications");
            if (container) {
                container.remove();
            }
        }
        this.logger.info("Realm Core DOM Adapter: Stopped.");
    }
}
