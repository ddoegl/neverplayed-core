/**
 * @file Activator for org.neverplayed.stratographer
 * @module platform/bundles/org.neverplayed.stratographer
 */

import { 
    STRATUM_SERVICE, 
    FLOW_SERVICE,
    REALM_MANAGER_SERVICE, 
    LOG_SERVICE 
} from "../../core-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    _logger = console;
    _stratum = null;
    _realmManager = null;

    start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratographer: Connected to Logger.");
                return logAdmin;
            }
        }).open();

        // 2. Track Stratum Core
        context.trackService(`(objectClass=${STRATUM_SERVICE})`, {
            addingService: (ref) => {
                this._stratum = context.getService(ref);
                return this._stratum;
            },
            removedService: () => { this._stratum = null; }
        }).open();

        // 3. Track Realm Manager (for Universe Switching)
        context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._realmManager = context.getService(ref);
                return this._realmManager;
            },
            removedService: () => { this._realmManager = null; }
        }).open();

        // 4. Define and Register Alpine Components
        this._setupAlpineHUD();

        // 5. Register Flow Service (The Dashboard)
        context.registerService(FLOW_SERVICE, this, {
            "flow.id": "stratographer",
            "flow.title": "Stratographer",
            "icon": "fas fa-map-marked-alt",
            "sidebar": true
        });

        // 6. Inject Minimal HUD template
        this._injectHUD();

        this._logger.info("Stratographer: Registered 🪐🛡️🔍");
    }

    /**
     * Protocol: launch (Flow Service Handshake)
     */
    async launch(options = {}) {
        this._logger.info("Stratographer Dashboard: Launching...");
        const self = this;

        // Ensure topology is fresh before rendering
        const explorerStore = Alpine.store('explorer');
        if (explorerStore) {
            await explorerStore.refreshTopology();
        }

        // Note: 'render' logic is usually provided by alpine-base, 
        // here we use a manual implementation to ensure full control over the 3-column stage.
        const templatePath = `./bundles/org.neverplayed.stratographer/templates/dashboard.html`;
        
        try {
            const resp = await fetch(templatePath);
            const html = await resp.text();
            
            const stage = document.querySelector("#flow-active-stage");
            if (!stage) throw new Error("Stage #flow-active-stage not found.");
            
            // Atomic Injection
            stage.innerHTML = html;
            
            // Component Binding
            Alpine.data("stratographerDashboard", () => ({
                jumpTarget: self._stratum?.toURI() || "",
                identityId: self._stratum?.identityId || "unknown",
                realmId: self._stratum?.realmId || "unknown",
                tenantId: self._stratum?.tenantId || "unknown",
                tier: self._stratum?.tier || "local",
                realms: [],
                activeRealm: { id: self._stratum?.realmId || "unknown" },

                async init() {
                    this.realms = await self._realmManager.getRealms();
                    this.activeRealm = this.realms.find(r => r.id === this.realmId) || { id: this.realmId };
                    
                    // Sovereign Sync: Update Address Bar on context shifts
                    globalThis.addEventListener('pm-context-shifted', () => {
                        this.identityId = self._stratum?.identityId;
                        this.realmId = self._stratum?.realmId;
                        this.tenantId = self._stratum?.tenantId;
                        this.tier = self._stratum?.tier;
                        this.jumpTarget = self._stratum?.toURI();
                        this.activeRealm = this.realms.find(r => r.id === this.realmId) || { id: this.realmId };
                    });

                    // Perspective Sync: Mirror cognitive shifts in the URI
                    this.$watch('$store.explorer.perspective', () => {
                        this.jumpTarget = self._stratum?.toURI();
                    });
                },

                copyURI() {
                    const uri = self._stratum?.toURI();
                    if (uri) {
                        navigator.clipboard.writeText(uri);
                        self._logger.info(`Stratum URI copied: ${uri}`);
                    }
                },

                jump() {
                    if (!this.jumpTarget) return;
                    self._logger.info(`Stratographer Jump: ${this.jumpTarget}`);
                    // Dispatch to shell-execute to handle the jump command logic
                    globalThis.dispatchEvent(new CustomEvent("shell-execute", { 
                        detail: { command: `stratum jump ${this.jumpTarget}` } 
                    }));
                },

                async switchTo(id) {
                    if (self._realmManager) {
                        await self._realmManager.switchRealm(id);
                    }
                }
            }));

            // Force x-data activation
            const dashboardEl = stage.querySelector("#stratographer-dashboard");
            if (dashboardEl) {
                // We add x-data dynamically to bind to the data defined above
                dashboardEl.setAttribute("x-data", "stratographerDashboard");
            }
            
        } catch (err) {
            this._logger.error("Stratographer Launch Failed:", err);
        }
    }

    _setupAlpineHUD() {
        const self = this;
        Alpine.data("stratographerHUD", () => ({
            get identityId() { return self._stratum?.identityId || "guest"; },
            get tier() { return self._stratum?.tier || "local"; },

            copyURI() {
                const uri = self._stratum?.toURI();
                if (uri) navigator.clipboard.writeText(uri);
            },

            openDashboard() {
                self._logger?.info("Igniting Stratographer Flow...");
                globalThis.dispatchEvent(new CustomEvent("shell-execute", { detail: { command: "flow-launch stratographer" } }));
            }
        }));
    }

    async _injectHUD() {
        const templatePath = `./bundles/org.neverplayed.stratographer/templates/stratum-hud.html`;
        try {
            const resp = await fetch(templatePath);
            const _html = await resp.text();
            const div = document.createElement('div');
            div.innerHTML = _html;
            document.body.appendChild(div.firstElementChild);
        } catch (err) {
            this._logger.error("Failed to inject Stratographer HUD", err);
        }
    }

    stop() {
        this._logger.info("Stratographer: Stopped.");
    }
}
