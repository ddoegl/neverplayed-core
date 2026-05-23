/**
 * @file Activator for org.neverplayed.realm.core
 * @module platform/bundles/org.neverplayed.realm.core
 */

import { 
    REALM_COGNITION_SERVICE, 
    SESSION_SERVICE, 
    STRATUM_SERVICE, 
    EVENT_HANDLER_INTERFACE, 
    EVENT_TOPIC 
} from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _session = null;
    _stratum = null;
    _predictionError = 0.0;
    _homeostasisScheduled = false;
    _reifiedPids = [];

    async onStart(context) {
        // 1. Track Session Service
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                this._scheduleHomeostasis();
                return this._session;
            },
            removedService: () => {
                this._session = null;
            }
        });

        // 2. Track Stratum Service (Required by Capability)
        this.track(`(objectClass=${STRATUM_SERVICE})`, {
            addingService: (ref) => {
                this._stratum = context.getService(ref);
                return this._stratum;
            },
            removedService: () => {
                this._stratum = null;
            }
        });

        // 3. Register RealmCognitionService
        context.registerService(REALM_COGNITION_SERVICE, {
            getPredictionError: () => this.getPredictionError(),
            getReifiedPids: () => this._reifiedPids
        }, { "realm.id": "org.neverplayed.realm.core" });

        // 4. Register Event Handler for Session, Realm, Persistence and Stratum changes
        const topics = [
            "org/neverplayed/session/CHANGED",
            "org/neverplayed/realm/CHANGED",
            "org/neverplayed/persistence/CONTEXT_CHANGED",
            "org/neverplayed/persistence/CHANGED",
            "org/neverplayed/stratum/CHANGED"
        ];

        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (_event) => {
                this._scheduleHomeostasis();
            }
        }, { [EVENT_TOPIC]: topics });

        this.logger.info("Realm Core Cognition Service: Registered 🧠✨");
    }

    getPredictionError() {
        return this._predictionError;
    }

    _scheduleHomeostasis() {
        if (this._homeostasisScheduled) return;
        this._homeostasisScheduled = true;
        queueMicrotask(() => this.homeostasisStep());
    }

    async homeostasisStep() {
        this._homeostasisScheduled = false;

        // --- Epistemic Sensation (Config Traces) ---
        if (this.persistence && typeof this.persistence.listKeys === 'function') {
            try {
                const configKeys = (await this.persistence.listKeys("config.")) || [];
                this._reifiedPids = configKeys.map(key => key.substring(7));
            } catch (err) {
                this.logger.error("Realm Core: Failed sensing config traces", err);
            }
        }

        this.dispatch("core-realm-homeostasis-completed", { reifiedPids: this._reifiedPids });

        if (!this._session) return;

        const realmId = this._session.activeRealmId;
        if (!realmId) return;

        const stack = this._session.scopedUsers?.[realmId];
        if (!stack) return;

        let error = 0.0;
        const staleUsers = [];
        const now = Date.now();

        for (const [userId, user] of Object.entries(stack)) {
            if (userId === '__activeId__' || userId === 'guest') continue;
            if (user && user.loggedIn) {
                const lastActive = user.lastActiveTime || 0;
                if (now - lastActive > 30000) {
                    error += 0.5;
                    staleUsers.push(userId);
                }
            }
        }

        this._predictionError = error;

        if (this._predictionError > 0) {
            this.logger.info(`Homeostasis: Prediction error is ${this._predictionError}. Executing active inference for stale occupants: ${JSON.stringify(staleUsers)}`);
            for (const userId of staleUsers) {
                this._session.logout(realmId, userId);
            }
            // Reset prediction error to 0 after inference (cleanup)
            this._predictionError = 0.0;
        }
    }
}
