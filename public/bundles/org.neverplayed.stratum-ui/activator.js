/**
 * @file Activator for org.neverplayed.stratum-ui
 * @module platform/bundles/org.neverplayed.stratum-ui
 */

import { 
    STRATUM_SERVICE, 
    UI_FACTORY_SERVICE as _UI_FACTORY_SERVICE, 
    LOG_SERVICE 
} from "../../core-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    _logger = console;
    _stratum = null;

    start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratum UI: Connected to Logger.");
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

        // 3. Define and Register Alpine Component
        Alpine.data("stratumHUD", () => ({
            visible: true,
            jumpTarget: "",
            
            get facetList() {
                if (!this._getStratum()) return [];
                const s = this._getStratum();
                return [
                    { label: 'Identity', value: s.identityId, sub: s.tenantId, icon: 'fas fa-id-badge', color: 'bg-emerald-500' },
                    { label: 'Dimension', value: s.realmId.split('.').pop().toUpperCase(), sub: s.flowId, icon: 'fas fa-shuttle-launch', color: 'bg-cyan-500' }
                ];
            },

            get tier() {
                return this._getStratum()?.tier || 'local';
            },

            get tierColor() {
                const isCloud = this.tier === 'cloud';
                return {
                    bg: isCloud ? 'bg-amber-400' : 'bg-cyan-400',
                    text: isCloud ? 'text-amber-400' : 'text-cyan-400'
                };
            },

            copyURI() {
                const uri = this._getStratum()?.toURI();
                if (uri) {
                    navigator.clipboard.writeText(uri);
                    console.info(`Stratum URI copied to clipboard: ${uri}`);
                }
            },

            jump() {
                if (!this.jumpTarget) return;
                const cmd = `stratum jump ${this.jumpTarget}`;
                console.info(`UI Triggering Stratum Jump: ${this.jumpTarget}`);
                globalThis.dispatchEvent(new CustomEvent("shell-execute", { detail: { command: cmd } }));
                this.jumpTarget = "";
            },

            _getStratum: () => this._stratum
        }));

        // 4. Inject HUD template into Shell
        this._injectHUD();

        this._logger.info("Stratum UI: Registered 🎨🪐");
    }

    async _injectHUD() {
        const templatePath = `./bundles/org.neverplayed.stratum-ui/templates/stratum-hud.html`;
        try {
            const resp = await fetch(templatePath);
            if (!resp.ok) throw new Error(`Template not found: ${templatePath}`);
            const _html = await resp.text();
            
            const div = document.createElement('div');
            div.innerHTML = _html;
            document.body.appendChild(div.firstElementChild);
        } catch (_err) {
            // Error logged by console or internal logger
        }
    }

    stop() {
        this._logger.info("Stratum UI: Stopped.");
    }
}
