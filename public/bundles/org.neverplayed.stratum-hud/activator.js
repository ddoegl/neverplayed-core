/**
 * @file Activator for org.neverplayed.stratum-hud
 * v2.6.0 - Rebranded from Stratographer
 */

import { 
    STRATUM_SERVICE, 
    LOG_SERVICE,
    PERCEIVER_SERVICE
} from "../../core-types.js";
import _Alpine from "https://esm.sh/alpinejs@3.13.5";
const Alpine = globalThis.Alpine || _Alpine;

export default class Activator {
    _logger = console;
    _stratum = null;
    _perceiver = null;

    start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger("stratum-hud");
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

        // 3. Track Perceiver Service
        context.trackService(`(objectClass=${PERCEIVER_SERVICE})`, {
            addingService: (ref) => {
                this._perceiver = context.getService(ref);
                return this._perceiver;
            },
            removedService: () => { this._perceiver = null; }
        }).open();

        // 4. Register Alpine HUD Component
        this._setupAlpineHUD();

        // 5. Inject HUD Template
        this._injectHUD();

        this._logger.info("Stratum HUD: Operational 👁️");
    }

    _setupAlpineHUD() {
        const self = this;
        Alpine.data("stratumHUD", () => ({
            get beingId() { 
                const ctx = self._perceiver?.getContext();
                return ctx?.being?.id || "guest"; 
            },
            get tier() { return self._stratum?.tier || "local"; },
            get grounding() {
                const ctx = self._perceiver?.getContext();
                return ctx?.surrogate?.grounding || "idealist";
            },

            copyURI() {
                const uri = self._stratum?.toURI();
                if (uri) navigator.clipboard.writeText(uri);
            },

            openStratographer() {
                self._logger?.info("Launching Stratographer (Explorer)...");
                // The Explorer (now Stratographer) is usually toggled via Alpine store
                const store = Alpine.store('explorer');
                if (store) store.visible = true;
            }
        }));
    }

    async _injectHUD() {
        const templatePath = `./bundles/org.neverplayed.stratum-hud/templates/stratum-hud.html`;
        try {
            const resp = await fetch(templatePath);
            const html = await resp.text();
            const div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div.firstElementChild);
        } catch (err) {
            this._logger.error("Failed to inject Stratum HUD template", err);
        }
    }

    stop() {
        this._logger.info("Stratum HUD: Stopped.");
    }
}
