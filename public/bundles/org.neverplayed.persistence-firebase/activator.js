/**
 * @file Activator for org.neverplayed.persistence-firebase
 * @module platform/bundles/org.neverplayed.persistence-firebase
 */

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
    _shuntingQueue = [];
    _isShuntingProcessing = false;
    _shuntingTimer = null;
    _isStopped = false;
    _isHydrating = false;
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

        const { initializeFirestore, doc, setDoc, onSnapshot } = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
        const app = getApp();
        
        // Force Long Polling to bypass QUIC resets (ERR_QUIC_PROTOCOL_ERROR)
        this._db = initializeFirestore(app, {
            experimentalForceLongPolling: true
        });
        
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

        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger(this.bsn);
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
            globalThis.dispatchEvent(new CustomEvent('pm-hydrated', { detail: { tier: 'cloud', implementation: 'firebase' } }));
        }, async (err) => {
            this.logger.error(`Firebase Persistence: Sync error (Transport reset likely):`, err);
            
            // ATTEMPT SHUNTED READ FALLBACK
            try {
                this.logger.info("Firebase Persistence: Attempting Stateless Read Fallback via Stealth Tunnel...");
                const data = await this._shuntedFetch(uid);
                if (data) {
                    this._cache.clear();
                    for (const [key, val] of Object.entries(data)) {
                        this._cache.set(key, val);
                    }
                    this.logger.info(`Firebase Persistence: Shunted hydration successful. ${Object.keys(data).length} keys recovered.`);
                }
            } catch (subErr) {
                this.logger.error("Firebase Persistence: Stateless Read Fallback also failed.", subErr);
            }
            
            // Critical transition: Now that we've tried both SDK and Fallback, we are as ready as we'll ever be.
            this._isHydrating = false;
            this._resolveReady();
            globalThis.dispatchEvent(new CustomEvent('pm-hydrated', { detail: { tier: 'cloud', implementation: 'firebase', error: true } }));
        });
    }

    async _shuntedFetch(uid) {
        const shuntingUrl = "https://mcpapi-ya355i2z4a-ez.a.run.app";
        try {
            const idToken = await globalThis.NEVERPLAYED_GET_ID_TOKEN?.();
            if (!idToken) throw new Error("ID Token not available.");

            const response = await fetch(shuntingUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-mcp-token": idToken },
                body: JSON.stringify({ action: "getConfig", payload: { uid } })
            });

            if (!response.ok) throw new Error(`Shunting API status: ${response.status}`);
            const result = await response.json();
            return result.data;
        } catch (err) {
            this.logger.warn("Firebase Persistence: Shunted fetch failed:", err.message);
            throw err;
        }
    }

    _scrubPayload(data) {
        if (!data || typeof data !== 'object' || data === null) return data;
        const clean = Array.isArray(data) ? [] : {};
        let modified = false;

        for (const [key, val] of Object.entries(data)) {
            if (typeof val === 'function') {
                this.logger.error(`ARCHITECTURE VIOLATION: Property '${key}' is a function. Stripping from cloud persistence to prevent Firestore crash.`);
                modified = true;
                continue;
            }
            if (val && typeof val === 'object') {
                const sub = this._scrubPayload(val);
                if (sub !== val) modified = true;
                clean[key] = sub;
            } else {
                clean[key] = val;
            }
        }
        return modified ? clean : data;
    }

    async _attemptShunt(key, cleanVal, sdkError) {
        if (sdkError) {
            this.logger.warn(`Firebase Persistence: SDK operation failed for '${key}' (${sdkError.message}). Attempting stateless shunting fallback...`);
        } else {
            this.logger.info(`Firebase Persistence: SDK not ready for '${key}'. Attempting proactive shunting fallback...`);
        }
        
        const shuntingUrl = "https://mcpapi-ya355i2z4a-ez.a.run.app";
        
        try {
            const idToken = await (globalThis['NEVERPLAYED_GET_ID_TOKEN']?.());
            if (!idToken) throw new Error("ID Token not available in shell context.");

            const response = await fetch(shuntingUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-mcp-token": idToken },
                body: JSON.stringify({
                    action: "updateConfig",
                    payload: { pid: key, properties: cleanVal, uid: this._userId || "unknown" }
                })
            });

            if (!response.ok) throw new Error(`Shunting API rejected request: ${response.status}`);
            this.logger.info(`Firebase Persistence: Shunted config ${key} successfully via Stealth Tunnel.`);
        } catch (subErr) {
            if (subErr.message.includes("ID Token not available")) {
                this.logger.warn(`Firebase Persistence: Shunting for '${key}' deferred. Identity not yet established. Queuing...`);
                this._queueShunt(key, cleanVal);
            } else {
                this.logger.error(`Firebase Persistence: Critical failure in both SDK and Fallback for '${key}': ${subErr.message}`);
                if (sdkError) throw sdkError; 
                throw subErr;
            }
        }
    }

    _queueShunt(key, val) {
        this._shuntingQueue.push({ key, val, timestamp: Date.now() });
        // Start an interval to check for tokens if not already processing
        if (!this._isShuntingProcessing) {
            this._processShuntQueue();
        }
    }

    async _processShuntQueue() {
        if (this._shuntingQueue.length === 0) {
            this._isShuntingProcessing = false;
            return;
        }
        this._isShuntingProcessing = true;

        const idToken = await (globalThis['NEVERPLAYED_GET_ID_TOKEN']?.());
        if (!idToken) {
            // Wait 2s and retry (faster for tests and responsiveness)
            if (!this._isStopped) {
                this._shuntingTimer = setTimeout(() => this._processShuntQueue(), 2000);
            }
            return;
        }

        this.logger.info(`Firebase Persistence: Identity established. Processing ${this._shuntingQueue.length} queued shunts...`);
        const item = this._shuntingQueue.shift();
        if (item) {
            try {
                await this.store(item.key, item.val);
            } catch (_err) {
                this.logger.error(`Firebase Persistence: Deferred shunt failed for '${item.key}'.`);
            }
        }
        
        // Process next item
        if (!this._isStopped) {
            this._shuntingTimer = setTimeout(() => this._processShuntQueue(), 100);
        }
    }

    load(key) {
        const val = this._cache.get(key);
        if (val !== undefined) return val;
        
        // If not in cache and SDK not ready, attempt shunted fetch in the background if not already hydrating
        if ((!this._db || !this._userId) && !this._isHydrating) {
            this._isHydrating = true;
            this._shuntedFetch(this._userId || "unknown").then(shuntedData => {
                const remoteVal = shuntedData?.config?.[key] || null;
                if (remoteVal !== null) {
                    this._cache.set(key, remoteVal);
                }
                this._isHydrating = false;
            }).catch(err => {
                this.logger.warn(`Firebase Persistence: Background hydration failed for '${key}':`, err.message);
                this._isHydrating = false;
            });
        }
        return null;
    }

    async store(key, val) {
        // SANITY SCRUB: Prevent Firestore crash from functions
        const cleanVal = this._scrubPayload(val);
        this._cache.set(key, cleanVal);
        
        if (this._db && this._userId && this._setDoc && this._docFn) {
            try {
                await this._setDoc(
                    this._docFn(this._db, COLLECTION, this._userId),
                    { [key]: cleanVal },
                    { merge: true }
                );
            } catch (err) {
                await this._attemptShunt(key, cleanVal, err);
            }
        } else {
            // SDK NOT READY: Attempt proactive shunt
            await this._attemptShunt(key, cleanVal);
        }
    }

    _registerService(context) {
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            waitReady: () => this._readyPromise,
            load: (key) => this.load(key),
            store: (key, val) => this.store(key, val),
            listKeys: (prefix = "") => {
                return Array.from(this._cache.keys()).filter(k => k.startsWith(prefix));
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
        this._isStopped = true;
        if (this._unsub) this._unsub();
        if (this._shuntingTimer) clearTimeout(this._shuntingTimer);
        this.logger.info("Firebase Persistence Manager: Stopped.");
    }
}

