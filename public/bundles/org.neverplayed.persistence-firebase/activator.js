import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/10.8.0";
const COLLECTION = "neverplayed_persistence";

export default class Activator extends BaseActivator {
    _cache = new Map();
    _db = null;
    _userId = null;
    _setDoc = null;
    _docFn = null;
    _unsubscribeAuth = null;

    async onStart(context) {
        const { getApps, getApp } = await import(`${FIREBASE_CDN}/firebase-app.js`);
        const apps = getApps();

        if (!apps.length) {
            this.logger.warn("Firebase Persistence: No Firebase app initialized. Using in-memory storage only.");
            this._registerService(context);
            return;
        }

        const { getFirestore, doc, getDoc, setDoc } = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
        const { getAuth, onAuthStateChanged } = await import(`${FIREBASE_CDN}/firebase-auth.js`);

        const app = getApp();
        this._db = getFirestore(app);
        this._setDoc = setDoc;
        this._docFn = doc;

        const auth = getAuth(app);
        const self = this;

        this._unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                self._userId = user.uid;
                try {
                    const snap = await getDoc(doc(self._db, COLLECTION, user.uid));
                    if (snap.exists()) {
                        for (const [key, val] of Object.entries(snap.data())) {
                            self._cache.set(key, val);
                        }
                        self.logger.info(`Firebase Persistence: Hydrated ${self._cache.size} entries for user ${user.uid}.`);
                    }
                } catch (err) {
                    self.logger.warn(`Firebase Persistence: Hydration failed: ${err.message}`);
                }
            } else {
                self._userId = null;
                self._cache.clear();
                self.logger.info("Firebase Persistence: User signed out, cache cleared.");
            }
        });

        this._registerService(context);
        this.logger.info("Firebase Persistence Manager: ACTIVE (Firestore).");
    }

    _registerService(context) {
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            load: (key) => {
                const val = this._cache.get(key);
                return val !== undefined ? val : null;
            },
            store: (key, val) => {
                this._cache.set(key, val);
                if (this._db && this._userId && this._setDoc && this._docFn) {
                    this._setDoc(
                        this._docFn(this._db, COLLECTION, this._userId),
                        { [key]: val },
                        { merge: true }
                    ).catch((err) => {
                        this.logger.warn(`Firebase Persistence: Store failed for '${key}': ${err.message}`);
                    });
                }
            }
        }, {
            "capability": "sys:persistence",
            "implementation": "firebase-firestore"
        });
    }

    onStop(_context) {
        if (this._unsubscribeAuth) {
            this._unsubscribeAuth();
            this._unsubscribeAuth = null;
        }
        this.logger.info("Firebase Persistence Manager: STOPPED.");
    }
}
