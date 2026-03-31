import { PERSISTENCE_MANAGER_SERVICE, AUTH_SHIELD_SERVICE, LOG_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/10.8.0";
const COLLECTION = "persistence";

export default class Activator extends BaseActivator {
    _cache = new Map();
    _db = null;
    _userId = null;
    _setDoc = null;
    _docFn = null;
    _unsub = null;
    _readyPromise = null;
    _resolveReady = null;

    async onStart(context) {
        this._readyPromise = new Promise(resolve => {
            this._resolveReady = resolve;
        });

        // 1. Core Logic Setup
        const { getApps, getApp } = await import(`${FIREBASE_CDN}/firebase-app.js`);
        const apps = getApps();

        if (!apps.length) {
            this.logger.warn("Firebase Persistence: No Firebase app initialized. Falling back to in-memory.");
            this._registerService(context);
            this._resolveReady();
            return;
        }

        const { getFirestore, doc, setDoc, onSnapshot } = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
        const app = getApp();
        this._db = getFirestore(app);
        this._setDoc = setDoc;
        this._docFn = doc;

        // 2. Track AuthShield for Identity
        context.trackService(`(objectClass=${AUTH_SHIELD_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                const user = svc.getCurrentUser();
                if (user && user.uid !== this._userId) {
                    this._setupSync(user.uid, onSnapshot);
                }
                return svc;
            },
            removedService: () => {
                if (this._unsub) this._unsub();
                this._userId = null;
                this._cache.clear();
                this.logger.info("Firebase Persistence: User session lost, sync stopped.");
            }
        }).open();

        // 3. Track Logger
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("neverplayed.persistence-firebase");
                this.logger.info("Firebase Persistence: Connected to System Logger.");
                return svc;
            }
        }).open();

        this._registerService(context);
    }

    _setupSync(uid, onSnapshot) {
        if (this._unsub) this._unsub();
        this._userId = uid;
        this.logger.info(`Firebase Persistence: Seeting up real-time sync for user ${uid}...`);
        
        this._unsub = onSnapshot(this._docFn(this._db, COLLECTION, uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                this._cache.clear(); // Fresh start for the cache from remote source
                for (const [key, val] of Object.entries(data)) {
                    this._cache.set(key, val);
                }
                this.logger.info(`Firebase Persistence: Remote update detected. Hydrated ${Object.keys(data).length} keys.`);
            } else {
                this.logger.info("Firebase Persistence: No existing cloud state found.");
            }
            this._resolveReady();
        }, (err) => {
            this.logger.error(`Firebase Persistence: Sync error for ${uid}:`, err);
            this._resolveReady();
        });
    }

    _registerService(context) {
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            waitReady: () => this._readyPromise,
            load: (key) => {
                const val = this._cache.get(key);
                return val !== undefined ? val : null;
            },
            store: async (key, val) => {
                this._cache.set(key, val);
                if (this._db && this._userId && this._setDoc && this._docFn) {
                    try {
                        await this._setDoc(
                            this._docFn(this._db, COLLECTION, this._userId),
                            { [key]: val },
                            { merge: true }
                        );
                    } catch (err) {
                        this.logger.error(`Firebase Persistence: Store failed for '${key}': ${err.message}`);
                        throw err; // Propagate to ConfigAdmin
                    }
                }
            },
            clear: async () => {
                this._cache.clear();
                if (this._db && this._userId && this._setDoc && this._docFn) {
                    // Overwrite document with completely empty object to erase all fields
                    await this._setDoc(this._docFn(this._db, COLLECTION, this._userId), {});
                    this.logger.info("Firebase Persistence: Cloud state cleared.");
                }
            }
        }, {
            "capability": "sys:persistence",
            "implementation": "firebase-firestore",
            "persistence.type": "provider",
            "persistence.tier": "cloud",
            "persistence.scope": "global",
            "service.ranking": 20
        });
        this.logger.info("Firebase Persistence Manager: Registered.");
    }

    onStop(_context) {
        if (this._unsub) this._unsub();
        this.logger.info("Firebase Persistence Manager: Stopped.");
    }
}

