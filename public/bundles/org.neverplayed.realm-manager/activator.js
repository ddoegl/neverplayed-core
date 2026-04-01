import { REALM_MANAGER_SERVICE, LOG_SERVICE, SESSION_SERVICE } from "../../shared-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _realms = new Map();
    _activeRealmId = null;
    _isTransitioning = false;

    onStart(context) {
        // 1. Initialize Logger
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("neverplayed.realm-manager");
                this.logger.info("Realm Manager: Connected to System Logger. Orchestration Bridge ready.");
                return svc;
            }
        }).open();
        
        // 1.2 Track Session Service
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this.session = context.getService(ref);
                this.logger?.info("Realm Manager: Connected to Session Service. Privilege Injection active.");
                return this.session;
            }
        }).open();

        // 2. Register Foundation Service
        context.registerService(REALM_MANAGER_SERVICE, {
            registerRealm: (manifest) => this._registerRealm(manifest),
            switchRealm: (id) => this._switchRealm(context, id),
            getActiveRealm: () => this._activeRealmId,
            getRealms: () => Array.from(this._realms.values())
        });
        
        this.logger?.info("Realm Manager: Registered Core Service.");
    }

    _registerRealm(manifest) {
        if (!manifest.id) throw new Error("Realm manifest must have a unique ID.");
        this._realms.set(manifest.id, manifest);
        this.logger?.info(`Realm Manager: Registered universe '${manifest.id}' (${manifest.title})`);
    }

    async _switchRealm(context, id) {
        if (this._isTransitioning) {
            this.logger?.warn("Realm Manager: Transition already in progress. Ignoring request.");
            return;
        }
        
        const manifest = this._realms.get(id);
        if (!manifest) {
            this.logger?.error(`Realm Manager: Universe '${id}' not found in registry.`);
            throw new Error(`Realm '${id}' not found.`);
        }

        this.logger?.info(`Realm Manager: Initiating Context Transition to universe '${id}'...`);
        this._isTransitioning = true;
        
        try {
            // 1. Resolve Hierarchy
            const hierarchy = await this._resolveHierarchy(id);
            this.logger?.info(`Realm Manager: Resolved Layered Hierarchy: ${hierarchy.map(m => m.id).join(" -> ")}`);

            // 2. Install/Start Bundles for ALL layers
            for (const layer of hierarchy) {
                if (!layer.bundles) continue;
                this.logger?.info(`Realm Manager: Activating Layer '${layer.id}'...`);
                
                for (const bundleUrl of layer.bundles) {
                    try {
                        const bundle = await context.installBundle(bundleUrl);
                        if (bundle.state === 2 || bundle.state === 4) { // Installed or Resolved
                            await bundle.start();
                        }
                    } catch (err) {
                        this.logger?.error(`Realm Manager: Failed to activate bundle '${bundleUrl}' in layer '${layer.id}':`, err.message);
                    }
                }
            }
            
            // 2.2 Inject Realm privileges
            if (this.session && manifest.privileges && manifest.privileges["realm-admins"]) {
                const currentUser = this.session.scopedUsers?.["global"]?.id || this.session.currentUser?.id;
                const isAdmin = manifest.privileges["realm-admins"].includes(currentUser);
                
                if (isAdmin) {
                    this.logger?.info(`Realm Manager: Elevated privileges detected for user '${currentUser}'. Injecting 'realm-admin' attribute.`);
                    
                    // Inject into Session Service (Standard Context)
                    this.session.scopedUsers["global"].attributes = this.session.scopedUsers["global"].attributes || {};
                    this.session.scopedUsers["global"].attributes["realm-admin"] = true;

                    // Inject into Backoffice State (Limes Compatibility)
                    if (globalThis.backofficeState?.evaluatedData) {
                        const entry = globalThis.backofficeState.evaluatedData.find(d => String(d.user) === String(currentUser));
                        if (entry) {
                            entry.attributes = entry.attributes || {};
                            entry.attributes["realm-admin"] = true;
                            this.logger?.info(`Realm Manager: Synced 'realm-admin' to backofficeState.evaluatedData.`);
                        }
                    }
                } else {
                    // Reset if not in admin list for this specific realm
                    if (this.session.scopedUsers["global"]?.attributes) {
                        delete this.session.scopedUsers["global"].attributes["realm-admin"];
                    }
                    if (globalThis.backofficeState?.evaluatedData) {
                        const entry = globalThis.backofficeState.evaluatedData.find(d => String(d.user) === String(currentUser));
                        if (entry?.attributes) {
                            delete entry.attributes["realm-admin"];
                        }
                    }
                }
            }

            this._activeRealmId = id;
            this.logger?.info(`Realm Manager: Context Transition Successful. Universe '${id}' is now active. 🌌`);
            
            // 3. Dispatch Global Event for UI update
            globalThis.dispatchEvent(new CustomEvent("realm-switched", { detail: { id, manifest } }));

        } finally {
            this._isTransitioning = false;
        }
    }

    async _resolveHierarchy(id, visited = new Set()) {
        const manifest = this._realms.get(id);
        if (!manifest) return [];
        if (visited.has(id)) throw new Error(`Circular dependency detected in realm inheritance: ${id}`);
        visited.add(id);

        let hierarchy = [];
        if (manifest.extends && Array.isArray(manifest.extends)) {
            for (const parentId of manifest.extends) {
                const parentHierarchy = await this._resolveHierarchy(parentId, visited);
                hierarchy = [...hierarchy, ...parentHierarchy];
            }
        }

        // Deduplicate and append self
        const existingIds = new Set(hierarchy.map(m => m.id));
        if (!existingIds.has(id)) {
            hierarchy.push(manifest);
        }
        
        return hierarchy;
    }
}
