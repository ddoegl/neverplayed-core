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
    _userCache = new Map();
    _realmCache = new Map();
    _realmUnsub = null;
    _activeUid = null;

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

        const { initializeFirestore, doc, setDoc, onSnapshot, deleteField } = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
         const app = getApp();
         
         // Force Long Polling to bypass QUIC resets (ERR_QUIC_PROTOCOL_ERROR)
         this._db = initializeFirestore(app, {
             experimentalForceLongPolling: true
         });
         
         this._setDoc = setDoc;
         this._docFn = doc;
         this._deleteField = deleteField;

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
        if (this._realmUnsub) this._realmUnsub();
        this._userId = uid;
        this._activeUid = uid;
        this.logger.info(`Firebase Persistence: Setting up dual real-time sync (User: ${uid} | Realm: shared)...`);
        
        let userHydrated = false;
        let realmHydrated = false;
        const checkReady = (source) => {
            if (userHydrated && realmHydrated) {
                this.logger.info(`Firebase Persistence: Double Handshake Complete. (Source: ${source})`);
                this._resolveReady();
            }
        };
        
        const syncDoc = (docId, isRealm) => {
            return onSnapshot(this._docFn(this._db, COLLECTION, docId), (snap) => {
                const flatCache = new Map();
                if (snap.exists()) {
                    const data = snap.data() || {};
                    const flatten = (obj, prefix = "") => {
                        for (const [key, value] of Object.entries(obj)) {
                            const newKey = prefix ? `${prefix}.${key}` : key;
                            const isAtomicSpec = value && typeof value === 'object' && !Array.isArray(value) && 
                                (Object.prototype.hasOwnProperty.call(value, 'id') || Object.prototype.hasOwnProperty.call(value, 'blueprintId'));
                            if (value !== null) flatCache.set(newKey, value);
                            if (value && typeof value === 'object' && !Array.isArray(value) && !isAtomicSpec) flatten(value, newKey);
                        }
                    };
                    flatten(data);
                }
                
                if (isRealm) {
                    this._realmCache = flatCache;
                    realmHydrated = true;
                } else {
                    this._userCache = flatCache;
                    userHydrated = true;
                }
                
                this._cache = new Map([...this._userCache, ...this._realmCache]);
                this.logger.debug(`Firebase Persistence: Sync [${docId}] hydrated ${flatCache.size} keys.`);
                checkReady(docId);
                globalThis.dispatchEvent(new CustomEvent('pm-hydrated', { detail: { tier: 'cloud', implementation: 'firebase', scope: docId } }));
            }, (err) => {
                if (err.code === 'permission-denied' && isRealm) {
                    this.logger.warn(`Firebase Persistence: Shared Realm [${docId}] is blocked by Firestore rules. Falling back to Private Sovereignty.`);
                } else {
                    this.logger.error(`Firebase Persistence: Sync error for [${docId}]:`, err);
                }
                if (isRealm) realmHydrated = true; else userHydrated = true;
                checkReady(docId); 
            });
        };

        this._unsub = syncDoc(uid, false);
        this._realmUnsub = syncDoc('realm-shared', true);
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

    _getDocId(key) {
        const isShared = key.startsWith('realm.') || key.startsWith('blueprint.');
        return isShared ? 'realm-shared' : this._activeUid;
    }

    async _attemptShunt(key, cleanVal, sdkError) {
        if (sdkError) {
            this.logger.warn(`Firebase Persistence: SDK operation failed for '${key}' (${sdkError.message}). Attempting stateless shunting fallback...`);
        } else {
            this.logger.info(`Firebase Persistence: SDK not ready for '${key}'. Attempting proactive shunting fallback...`);
        }
        
        const shuntingUrl = "https://mcpapi-ya355i2z4a-ez.a.run.app";
        const docId = this._getDocId(key);
        
        try {
            const idToken = await (globalThis['NEVERPLAYED_GET_ID_TOKEN']?.());
            if (!idToken) throw new Error("ID Token not available in shell context.");

            const response = await fetch(shuntingUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-mcp-token": idToken },
                body: JSON.stringify({
                    action: "updateConfig",
                    payload: { pid: key, properties: cleanVal, uid: docId || "unknown" }
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
        const isDeletion = cleanVal === null;
        
        if (isDeletion) {
            this._cache.delete(key);
        } else {
            this._cache.set(key, cleanVal);
        }
        
        const docId = this._getDocId(key);
        if (this._db && docId && this._setDoc && this._docFn) {
            try {
                const payload = { [key]: isDeletion ? this._deleteField() : cleanVal };
                await this._setDoc(
                    this._docFn(this._db, COLLECTION, docId),
                    payload,
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
            setContext: (ctx) => {
                this.logger.info(`[DIAGNOSTICS] Firebase: Context Shift -> [${ctx.tenantId}][${ctx.identityId}]`);
                if (ctx.tenantId && ctx.tenantId !== "guest") {
                    this._activeUid = ctx.tenantId;
                }
            },
            waitReady: () => this._readyPromise,
            load: (key) => this.load(key),
            store: (key, val) => this.store(key, val),
            listKeys: (prefix = "") => {
                return Array.from(this._cache.keys()).filter(k => k.startsWith(prefix));
            },
            clear: async (options = {}) => {
                const except = options.except || [];
                
                // 1. Clear Cache selectively
                for (const k of this._cache.keys()) {
                    if (!except.includes(k)) this._cache.delete(k);
                }

                if (this._db && this._userId && this._setDoc && this._docFn) {
                    if (except.length === 0) {
                        // Overwrite document with completely empty object to erase all fields
                        await this._setDoc(this._docFn(this._db, COLLECTION, this._userId), {});
                    } else {
                        // We would need to identify all existing keys and delete them one by one
                        // For now, we trust the cache sync will handle the visual cleanup, 
                        // and we only perform a full clear if no exceptions are provided.
                        this.logger.warn("Firebase Persistence: Selective clear (except) is partially implemented (cache only). Cloud fields remain until overwritten.");
                    }
                    this.logger.info("Firebase Persistence: Cloud state cleared (selective).");
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

