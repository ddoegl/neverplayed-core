import { SELECTION_SERVICE, CONFIG_ADMIN_SERVICE, SESSION_SERVICE, NEVERPLAYED_PREFIX, SHELL_CLI_SERVICE } from "core-types";
import { BaseActivator } from "osgi-base";
import { sendInvitationRequest as _sendInvitationRequest } from "../../auth-shield.js";

// Using globalThis.Alpine as guaranteed by index.html loader
const _Alpine = globalThis.Alpine;

export default class Activator extends BaseActivator {
    onStart(context) {
        this.history = [];
        this.logCounter = 0;
        this.listeners = new Set();

        const shellService = {
            execute: (input) => this.handleCommand(input, context),
            subscribe: (listener) => {
                this.listeners.add(listener);
                return () => this.listeners.delete(listener);
            },
            getHistory: () => [...this.history],
            getCommands: () => ["/invite", "/clear", "/whoami", "/vars", "/services", "/bundles", "/loglevel", "/start", "/stop", "/update", "/uninstall", "/install", "/reset-config", "/prime-all", "/diag-manifest", "/reload-ui", "/methods", "/actions", "/flows", "/caps", "/help"]
        };

        context.registerService(SHELL_CLI_SERVICE, shellService);
    }

    log(content, type = 'output') {
        let finalContent = content;
        if (typeof content === 'object' && content !== null) {
            try {
                finalContent = `<pre class="text-[10px] text-emerald-400 overflow-x-auto">${JSON.stringify(content, null, 2)}</pre>`;
            } catch (_e) {
                finalContent = String(content);
            }
        }

        const entry = { 
            id: ++this.logCounter,
            timestamp: Date.now(), 
            type, 
            content: finalContent 
        };
        this.history.push(entry);
        
        // Notify subscribers (Term/DOM UI)
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            } catch (_err) { /* ignore listener errors */ }
        });

        if (this.isHeadless) {
            const cleanLog = String(finalContent).replace(/<[^>]*>/g, '').trim();
            if (type === 'error') this.logger.error(`[SHELL] ${cleanLog}`);
            else this.logger.debug(`[SHELL] ${cleanLog}`);
        }
    }

    async handleCommand(input, context) {
        const parts = input.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        try {
            switch(command) {
                case '/help':
                    this.log(`
                        <div class="space-y-1">
                            <div class="text-white font-bold underline">Available Commands:</div>
                            <div><span class="text-yellow-400">/invite [email]</span> - Send fellowship invitation</div>
                            <div><span class="text-yellow-400">/clear</span> - Clear terminal history</div>
                            <div><span class="text-yellow-400">/whoami</span> - Show current session info</div>
                            <div><span class="text-yellow-400">/vars [category] [id]</span> - List and drill down flow variables</div>
                            <div><span class="text-yellow-400">/services [filter]</span> - List all registered service IDs</div>
                            <div><span class="text-yellow-400">/bundles [filter|ldap]</span> - List bundles (e.g. (Bundle-Name=*))</div>
                            <div><span class="text-yellow-400">/loglevel [level] [ids]</span> - Set log level (e.g. DEBUG 1,2)</div>
                            <div><span class="text-yellow-400">/start [id|bsn]</span> - Start a bundle</div>
                            <div><span class="text-yellow-400">/stop [id|bsn]</span> - Stop a bundle</div>
                            <div><span class="text-yellow-400">/update [id|bsn]</span> - Update a bundle</div>
                            <div><span class="text-yellow-400">/uninstall [id|bsn]</span> - Uninstall a bundle</div>
                            <div><span class="text-yellow-400">/install [url|@neverplayed/name]</span> - Install a new bundle</div>
                            <div><span class="text-yellow-400">/reset-config [pid]</span> - Clear persistent config & force manifest seed</div>
                            <div><span class="text-yellow-400">/prime-all [id|bsn]</span> - Sync manifest config to ConfigAdmin (hot-reload)</div>
                            <div><span class="text-yellow-400">/diag-manifest [id|url]</span> - Direct fetch manifest (bypass kernel cache)</div>
                            <div><span class="text-yellow-400">/reload-ui</span> - Hard refresh the browser window</div>
                            <div><span class="text-yellow-400">/methods [serviceId]</span> - List methods on a service</div>
                            <div><span class="text-yellow-400">/flows [filter]</span> - List all registered flows</div>
                            <div><span class="text-yellow-400">/caps [filter]</span> - List all unique capabilities</div>
                            <div><span class="text-yellow-400">/sidebar [id|bsn]</span> - Show sidebar</div>
                            <div><span class="text-yellow-400">/help</span> - Show this help message</div>
                        </div>
                    `);
                    break;
                    
                case '/clear':
                    this.history = [];
                    if (!this.isHeadless) {
                        const store = globalThis.Alpine?.store('shell');
                        if (store) store.history = [];
                    }
                    break;
                    
                case '/reload-ui':
                    this.log("Forcing UI Reload...");
                    if (globalThis.location) globalThis.location.reload();
                    break;
                    
                case '/whoami': {
                    const sessionRef = context.getServiceReference(SESSION_SERVICE);
                    const session = sessionRef ? context.getService(sessionRef) : null;
                    const user = session?.currentUser;
                    if (user) {
                        this.log(`Active User: <span class="text-white">${user.alias || user.email || user.firstname}</span> (ID: ${user.id})`);
                    } else {
                        this.log("No active session found.", 'error');
                    }
                    break;
                }
                    
                case '/vars': {
                    const boState = globalThis.backofficeState;
                    if (!boState) {
                        this.log("Backoffice state not found.", 'error');
                        return;
                    }

                    const categoryArg = args[0];
                    const targetArg = args[1]; 

                    const categories = {
                        people: { data: boState.persons, label: "Persons" },
                        companies: { data: boState.companies, label: "Companies" },
                        cases: { data: boState.parsedDOInstances?.['backoffice-cases'] || [], label: "Cases" },
                        caseTypes: { data: boState.parsedCaseTypes || [], label: "Case Types" },
                        licenses: { data: boState.parsedLicenses?.LICENSES || [], label: "Licenses" },
                        selection: { 
                            data: context.getService(context.getServiceReference(SELECTION_SERVICE)) || {}, 
                            label: "Current Selection"
                        }
                    };

                    if (!categoryArg) {
                        this.log(`<div class="text-white font-bold">Variable Categories:</div>`);
                        Object.keys(categories).forEach(cat => {
                            this.log(` - <span class="text-yellow-400">${cat}</span> (${categories[cat].data?.length || 0} items)`);
                        });
                        return;
                    }

                    let items = categories[categoryArg.toLowerCase()]?.data;
                    let label = categories[categoryArg.toLowerCase()]?.label || categoryArg;

                    if (items === undefined) {
                        const ref = context.getServiceReference(categoryArg);
                        if (ref) {
                            const svc = context.getService(ref);
                            items = [svc];
                            label = `Service: ${categoryArg}`;
                        }
                    }

                    if (items === undefined) {
                        this.log(`No data source found for: ${categoryArg}`, 'error');
                        return;
                    }

                    if (!targetArg) {
                        this.log(`<div class="text-white font-bold">${label}:</div>`);
                        this.log(`<pre class="text-[10px] text-emerald-400">${JSON.stringify(items, null, 2)}</pre>`);
                        return;
                    }

                    const [id, ...pathParts] = targetArg.split('.');
                    const path = pathParts.join('.');
                    const item = Array.isArray(items) ? items.find(i => String(i.id) === String(id)) : items;

                    if (!item) {
                        this.log(`Item not found: ${id}`, 'error');
                        return;
                    }

                    let result = item;
                    if (path) {
                        result = path.split('.').reduce((obj, p) => obj?.[p], item);
                    }

                    this.log(`<div class="text-white font-bold">Inspect: ${label} / ${targetArg}</div>`);
                    this.log(`<pre class="text-[10px] text-emerald-400 overflow-x-auto">${JSON.stringify(result, null, 2)}</pre>`);
                    break;
                }

                case '/services': {
                    const filter = args[0]?.toLowerCase();
                    const refs = context.getServiceReferences(null, null) || [];
                    const ids = [...new Set(refs.flatMap(ref => ref.getProperty("objectClass") || []))].sort();
                    
                    if (filter) {
                        const matched = ids.filter(id => id.toLowerCase().includes(filter));
                        this.log(`<div class="text-white font-bold">Matching Services (${matched.length}):</div>`);
                        matched.forEach(id => this.log(` - ${id}`));
                    } else {
                        this.log(`<div class="text-white font-bold">Registered Services (${ids.length}):</div>`);
                        ids.forEach(id => this.log(` - ${id}`));
                    }
                    break;
                }

                case '/bundles': {
                    const filterStr = args[0];
                    const allBundles = context.getBundles().sort((a,b) => b.id - a.id);
                    const stateMap = { 1: 'UNINSTALLED', 2: 'INSTALLED', 4: 'RESOLVED', 8: 'STARTING', 16: 'STOPPING', 32: 'ACTIVE' };
                    
                    let matched = allBundles.filter(b => b.getState() !== 1);
                    if (filterStr) {
                        const fs = filterStr.toLowerCase();
                        matched = matched.filter(b => String(b.id) === fs || b.getSymbolicName().toLowerCase().includes(fs));
                    }

                    if (this.isHeadless) {
                        this.log("Universe Bundles:");
                        const table = matched.map(b => ` #${String(b.id).padEnd(3)} | [${(stateMap[b.getState()] || b.getState()).padEnd(10)}] | ${b.getSymbolicName()}`).join('\n');
                        this.log(table);
                    } else {
                        this.log(`<div class="text-white font-bold">Universe Bundles (${matched.length}):</div>`);
                        matched.forEach(b => {
                            const stateStr = stateMap[b.getState()] || b.getState();
                            const colorClass = stateStr === 'ACTIVE' ? 'text-emerald-400' : 'text-yellow-400';
                            this.log(` #${b.id} [<span class="${colorClass}">${stateStr}</span>] <span class="text-blue-400 cursor-pointer">${b.getSymbolicName()}</span>`);
                        });
                    }
                    break;
                }

                case '/methods': {
                    const serviceId = args[0];
                    if (!serviceId) {
                        this.log("Usage: /methods [serviceId]", 'error');
                        return;
                    }
                    const ref = context.getServiceReference(serviceId);
                    if (!ref) {
                        this.log(`Service not found: ${serviceId}`, 'error');
                        return;
                    }
                    const svc = context.getService(ref);
                    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(svc)).filter(m => typeof svc[m] === 'function' && m !== 'constructor').sort();
                    this.log(`<div class="text-white font-bold">Methods for ${serviceId}:</div>`);
                    methods.forEach(m => this.log(` - ${m}()`));
                    break;
                }

                case '/flows': {
                    const filter = args[0]?.toLowerCase();
                    const refs = context.getServiceReferences(FLOW_SERVICE, null) || [];
                    this.log(`<div class="text-white font-bold mb-2 underline">Registered Flows (${refs.length}):</div>`);
                    refs.forEach(ref => {
                        const id = ref.getProperty("flow.id") || "unknown";
                        const cap = ref.getProperty("capability") || "none";
                        if (!filter || id.toLowerCase().includes(filter) || cap.toLowerCase().includes(filter)) {
                            this.log(` - <span class="text-yellow-400">${id}</span> <span class="text-gray-400 text-[10px]">[Cap: ${cap}]</span>`);
                        }
                    });
                    break;
                }

                case '/start':
                case '/stop':
                case '/update':
                case '/uninstall': {
                    const target = args[0];
                    if (!target) return;
                    const action = command.slice(1);
                    const targets = context.getBundles().filter(b => String(b.id) === target || b.getSymbolicName() === target);
                    for (const b of targets) {
                        try {
                            this.log(`${action.charAt(0).toUpperCase() + action.slice(1)}ing bundle ${b.getSymbolicName()}...`);
                            if (action === 'start') await b.start();
                            else if (action === 'stop') await b.stop();
                            else if (action === 'update') await b.update();
                            else if (action === 'uninstall') await b.uninstall();
                        } catch (err) { this.log(`Action failed: ${err.message}`, 'error'); }
                    }
                    break;
                }

                case '/install': {
                    let url = args[0];
                    if (!url) return;
                    if (url.startsWith(NEVERPLAYED_PREFIX)) {
                        const name = url.replace(NEVERPLAYED_PREFIX, '');
                        const base = globalThis.NEVERPLAYED_BASE_URL || globalThis.location?.href || './';
                        try {
                            url = new URL(`./bundles/org.neverplayed.${name}/manifest.json`, base).href;
                        } catch (_e) {
                            url = `./bundles/org.neverplayed.${name}/manifest.json`;
                        }
                    }
                    
                    try {
                        const bustedUrl = this.isHeadless ? url : `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                        const response = await fetch(bustedUrl);
                        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        const manifest = await response.json();

                        // Fix activator path using raw absolute strategy
                        if (url.startsWith('file:') || (this.isHeadless && !url.startsWith('http'))) {
                            const baseUrl = url.replace(/[^\/]*\.json(\?.*)?$/, '').replace(/^file:\/+/ , "/");
                            const activator = manifest["Bundle-Activator"] || "activator.js";
                            manifest["Bundle-Activator"] = `/${baseUrl.replace(/^\/+/,'')}${activator.replace(/^\.\//, '')}`;
                        }

                        let b;
                        if (this.isHeadless) {
                            b = await context.installBundle(manifest);
                        } else {
                            // In web mode, the Pandino loader handles URL resolution/cache-busting better than passing a raw object
                            b = await context.installBundle(url);
                        }
                        
                        this.log(`Success: Installed bundle #${b.id} (${b.getSymbolicName()})`);
                        // Only start if not already starting/active
                        if (b.getState() < 32) await b.start();
                    } catch (err) { this.log(`Installation failed: ${err.message}`, 'error'); }
                    break;
                }

                case '/prime-all': {
                    const target = args[0];
                    const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                    const ca = caRef ? context.getService(caRef) : null;
                    if (!ca) return;
                    const bundles = context.getBundles().filter(b => b.state === 32 && (!target || b.getSymbolicName() === target));
                    for (const b of bundles) {
                        try {
                            const url = b.location || b.bundleLocation;
                            if (!url) continue;
                            const manifestUrl = this.isHeadless ? url : `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                            const manifest = await (await fetch(manifestUrl)).json();
                            if (manifest.Configuration) ca.getConfiguration(b.getSymbolicName()).update(manifest.Configuration);
                        } catch (_e) { /* ignore */ }
                    }
                    this.log("Re-primed configurations.");
                    break;
                }

                case '/sidebar': {
                    const target = args[0];
                    if (this.isHeadless) {
                        this.log("Sidebar commands are only reactive in the Web UI.", "warn");
                        break;
                    }
                    if (!target) {
                        globalThis.dispatchEvent(new CustomEvent('shell:sidebar-toggle'));
                        this.log("Toggled global sidebar (via DOM event).");
                    } else {
                        const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                        const ca = caRef ? context.getService(caRef) : null;
                        if (ca) {
                            const bundle = context.getBundles().find(b => String(b.id) === target || b.getSymbolicName() === target);
                            if (bundle) {
                                const bsn = bundle.getSymbolicName();
                                const config = ca.getConfiguration(bsn);
                                const props = config.getProperties() || {};
                                const newState = !props.sidebar;
                                await config.update({ ...props, sidebar: newState });
                                // Architectural "flows-updated" signal for index.html to re-evaluate isFlowEnabled
                                globalThis.dispatchEvent(new CustomEvent('shell:flows-updated'));
                                this.log(`Sidebar property for ${bsn} set to: ${newState} (signal dispatched).`);
                            }
                        }
                    }
                    break;
                }

                default:
                    this.log(`Unknown command: ${command}. Type /help for assistance.`, 'error');
            }
        } catch (pErr) {
            this.log(`Command Processing Error: ${pErr.message}`, 'error');
        }
    }

    stop(_context) {}
}
