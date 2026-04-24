/**
 * @file Activator for org.neverplayed.stratum-cli
 * @module platform/bundles/org.neverplayed.stratum-cli
 */

import { 
    STRATUM_SERVICE, 
    SHELL_COMMAND_SERVICE, 
    LOG_SERVICE,
    SESSION_SERVICE,
    REALM_MANAGER_SERVICE
} from "../../core-types.js";

export default class Activator {
    _logger = console;
    _stratum = null;

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
                            return log("Usage: /stratum jump np://tenant/identity/realm/flow?tier=xxx", 'error');
                        }
                        
                        log({ text: `🚀 Initiating Stratum Jump: ${uri}`, color: "yellow", bold: true });
                        
                        try {
                            // np://tenant/identity/realm/flow?tier=xxx
                            const url = new URL(uri.replace("np://", "http://")); 
                            const tenant = url.hostname;
                            const [, identity, realm, _flow] = url.pathname.split('/');
                            const _tier = url.searchParams.get("tier");

                            log(` -> Analyzing pivot: Tenant[${tenant}] | Identity[${identity}] | Realm[${realm}]`);

                            // 1. Session Pivot (Sovereign Login)
                            const sessionRef = context.getServiceReference(SESSION_SERVICE);
                            const session = sessionRef ? context.getService(sessionRef) : null;
                            if (session) {
                                log(` -> Pivoting Identity to ${identity}...`);
                                session.login(identity, realm);
                            }

                            // 2. Realm Pivot (Transition)
                            const realmRef = context.getServiceReference(REALM_MANAGER_SERVICE);
                            const realmSvc = realmRef ? context.getService(realmRef) : null;
                            if (realmSvc) {
                                log(` -> Pivoting Realm to ${realm}...`);
                                await realmSvc.switchRealm(realm);
                            }

                            log({ text: "✅ Stratum Jump Complete. Context Stabilized.", color: "green" });
                        } catch (err) {
                            log(`Jump failed: ${err.message}`, 'error');
                        }
                        break;
                    }
                    default:
                        log("Usage: /stratum <info|path|jump [uri]>");
                }
            }
        });

        this._logger.info("Stratum CLI: Registered 🐚🪐");
    }

    stop() {
        this._logger.info("Stratum CLI: Stopped.");
    }
}
