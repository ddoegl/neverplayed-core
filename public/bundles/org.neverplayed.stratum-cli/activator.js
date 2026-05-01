/**
 * @file Activator for org.neverplayed.stratum-cli
 * @module platform/bundles/org.neverplayed.stratum-cli
 */

import { 
    STRATUM_SERVICE, 
    SHELL_COMMAND_SERVICE, 
    LOG_SERVICE,
    PERSISTENCE_MANAGER_SERVICE
} from "../../core-types.js";

export default class Activator {
    _logger = console;
    _stratum = null;
    _pm = null;

    start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratum CLI: Connected to Logger.");
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

        // 2.1 Track Persistence Manager (Selector) for Tier Shunting
        context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(implementation=selector-proxy))`, {
            addingService: (ref) => {
                this._pm = context.getService(ref);
                return this._pm;
            },
            removedService: () => { this._pm = null; }
        }).open();

        // 3. Register /stratum command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "stratum",
            description: "Inspect and navigate the system's multidimensional context",
            execute: async (args, _ctx, log) => {
                const sub = args[0] || 'info';

                if (!this._stratum) {
                    return log("Stratum Service not available. Aggregation suspended.", 'error');
                }

                switch (sub) {
                    case 'info': {
                        log({ text: "🌌 Current Stratum Configuration", color: "blue", bold: true });
                        log(` Tenant (UID):     ${this._stratum.tenantId}`);
                        log(` Identity (SID):   ${this._stratum.identityId}`);
                        log(` Realm (WHERE):    ${this._stratum.realmId}`);
                        log(` Flow (CONTEXT):   ${this._stratum.flowId}`);
                        log(` Persistence:      ${this._stratum.tier}`);
                        break;
                    }
                    case 'path':
                    case 'uri': {
                        log({ text: "📍 Canonical Stratum URI:", color: "cyan" });
                        log(this._stratum.toURI());
                        break;
                    }
                    case 'jump': {
                        const uri = args[1];
                        if (!uri || !uri.startsWith("np://")) {
                            return log("Usage: /stratum jump np://tenant/[identity|realm]/[realm|identity]/[aperture]?tier=xxx", 'error');
                        }
                        
                        log({ text: `🚀 Initiating Stratum Jump: ${uri}`, color: "yellow", bold: true });
                        
                        try {
                            const result = await this._stratum.jump(uri);
                            log(` -> Analysis Complete: [${result.perspective.toUpperCase()}] Tenant[${result.tenant}] | Identity[${result.identity}] | Realm[${result.realm}] | Tier[${result.tier}]`);
                            log({ text: "✅ Stratum Jump Complete. Context Stabilized.", color: "green" });
                        } catch (err) {
                            log(`Jump failed: ${err.message}`, 'error');
                        }
                        break;
                    }
                    case 'stash': {
                        const key = args[1];
                        if (!key) {
                            return log("Usage: /stratum stash <key> [value]", 'error');
                        }
                        
                        if (!this._pm) return log("Persistence Manager not available.", 'error');
                        
                        try {
                            if (args.length > 2) {
                                // Write Mode
                                const val = args.slice(2).join(" ");
                                log(`📦 Stashing [${key}] into current Stratum...`);
                                await this._pm.store(key, val);
                                
                                const probe = await this._pm.probe(key);
                                log({ text: `✅ Stash Successful!`, color: "green" });
                                log(` -> Target Tier:      ${probe.tier}`);
                                log(` -> Physical Tier:    ${probe.physicalTier}`);
                                log(` -> Implementation: ${probe.implementation} (${probe.bsn})`);
                                log(` -> Stratum:        np://${probe.context.tenantId}/${probe.context.identityId}`);
                            } else {
                                // Read Mode
                                log(`🔍 Fetching [${key}] from current Stratum...`);
                                const val = await this._pm.load(key);
                                const probe = await this._pm.probe(key);
                                if (val !== null && val !== undefined) {
                                    log({ text: `✅ Fetch Successful!`, color: "green" });
                                    log(` -> Value:          ${typeof val === 'object' ? JSON.stringify(val) : val}`);
                                    log(` -> Target Tier:      ${probe.tier}`);
                                    log(` -> Physical Tier:    ${probe.physicalTier}`);
                                    log(` -> Implementation: ${probe.implementation} (${probe.bsn})`);
                                } else {
                                    log({ text: `❌ Nothing stashed at [${key}] in this radius.`, color: "yellow" });
                                }
                            }
                        } catch (err) {
                            log(`Stash operation failed: ${err.message}`, 'error');
                        }
                        break;
                    }
                    case 'perspective': {
                        const newPerspective = args[1];
                        if (newPerspective === 'idealist' || newPerspective === 'realist') {
                            this._stratum.perspective = newPerspective;
                            log(`Stratum Perspective set to: ${newPerspective.toUpperCase()}`);
                        } else {
                            log(`Current Perspective: ${this._stratum.perspective.toUpperCase()}`);
                            log("Usage: /stratum perspective [idealist|realist]");
                        }
                        break;
                    }
                    default:
                        log("Usage: /stratum <info|path|perspective|jump [uri]|stash>");
                }
            }
        });

        this._logger.info("Stratum CLI: Registered 🐚🪐");
    }

    stop() {
        this._logger.info("Stratum CLI: Stopped.");
    }
}
