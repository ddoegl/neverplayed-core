/**
 * @file Activator for org.neverplayed.stratum-cli
 * @module platform/bundles/org.neverplayed.stratum-cli
 */

import { 
    STRATUM_SERVICE, 
    SHELL_COMMAND_SERVICE, 
    LOG_SERVICE,
    SESSION_SERVICE,
    REALM_MANAGER_SERVICE,
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
                            const url = new URL(uri.replace("np://", "http://")); 
                            const tenant = url.hostname;
                            const segments = url.pathname.split('/').filter(s => s);
                            const _tier = url.searchParams.get("tier");

                            let identity, realm, perspective;

                            // Cognitive Detection: Deduce perspective from segment structure
                            if (segments[0]?.startsWith('org.neverplayed.realm')) {
                                realm = segments[0];
                                identity = segments[1];
                                perspective = 'realist';
                            } else {
                                identity = segments[0];
                                realm = segments[1];
                                perspective = 'idealist';
                            }
                            
                            // Ensure identity falls back to tenant if empty
                            identity = identity || tenant;
                            const aperture = segments[2] || 'shell';

                            log(` -> Analyzing pivot: [${perspective.toUpperCase()}] Tenant[${tenant}] | Identity[${identity}] | Realm[${realm}] | Tier[${_tier || 'local'}]`);

                            // 1. Persistence Pivot (Tier Shunting)
                            if (this._pm && _tier) {
                                log(` -> Shunting Persistence Tier to ${_tier}...`);
                                await this._pm.setContext({ tier: _tier });
                            }

                            // 2. Identity & Perspective Pivot
                            if (this._stratum) {
                                log(` -> Aligning Stratum Perspective to ${perspective.toUpperCase()}...`);
                                this._stratum.perspective = perspective;
                            }

                            const sessionRef = context.getServiceReference(SESSION_SERVICE);
                            const session = sessionRef ? context.getService(sessionRef) : null;
                            if (session && identity) {
                                log(` -> Pivoting Identity to ${identity}...`);
                                session.login(identity, realm);
                            }

                            // 3. Realm Pivot (Transition)
                            const realmRef = context.getServiceReference(REALM_MANAGER_SERVICE);
                            const realmSvc = realmRef ? context.getService(realmRef) : null;
                            if (realmSvc && realm) {
                                log(` -> Pivoting Realm to ${realm}...`);
                                await realmSvc.switchRealm(realm);
                            }

                            log({ text: "✅ Stratum Jump Complete. Context Stabilized.", color: "green" });
                        } catch (err) {
                            log(`Jump failed: ${err.message}`, 'error');
                        }
                        break;
                    }
                    case 'stash': {
                        const key = args[1];
                        const val = args[2];
                        if (!key || val === undefined) {
                            return log("Usage: /stratum stash <key> </value>", 'error');
                        }
                        
                        if (!this._pm) return log("Persistence Manager not available.", 'error');
                        
                        try {
                            log(`📦 Stashing [${key}] into current Stratum...`);
                            await this._pm.store(key, val);
                            
                            const probe = await this._pm.probe(key);
                            log({ text: `✅ Stash Successful!`, color: "green" });
                            log(` -> Tier:           ${probe.tier}`);
                            log(` -> Implementation: ${probe.implementation} (${probe.bsn})`);
                            log(` -> Stratum:        np://${probe.context.tenantId}/${probe.context.identityId}`);
                        } catch (err) {
                            log(`Stash failed: ${err.message}`, 'error');
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
