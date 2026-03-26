import { FLOW_SERVICE, SELECTION_SERVICE, CONFIG_ADMIN_SERVICE, ACTION_REGISTRY_SERVICE, SESSION_SERVICE, BUNDLE_TYPE_SERVICE, NEVERPLAYED_PREFIX, SHELL_CLI_PID, SHELL_CLI_SERVICE } from "core-types";
import { BaseActivator } from "osgi-base";
import { sendInvitationRequest as _sendInvitationRequest } from "../../auth-shield.js";

// Using globalThis.Alpine as guaranteed by index.html loader
const Alpine = globalThis.Alpine;

export default class Activator extends BaseActivator {
    onStart(context) {
        const logger = this.logger;


        // Initialize Global Shell State if not already present (Persistent across bundle updates)
        if (!Alpine.store('shell')) {
            Alpine.store('shell', {
                history: [],
                commandHistory: [],
                historyIndex: -1,
                
                addLog(content, type = 'output') {
                    const now = new Date();
                    const time = now.getHours().toString().padStart(2, '0') + ':' + 
                                now.getMinutes().toString().padStart(2, '0') + ':' + 
                                now.getSeconds().toString().padStart(2, '0');
                    
                    this.history.push({
                        timestamp: now.getTime() + Math.random(),
                        time,
                        type,
                        content
                    });
                    
                    // Auto-scroll logic
                    setTimeout(() => {
                        const el = document.querySelector('[x-ref="outputArea"]');
                        if (el) el.scrollTop = el.scrollHeight;
                    }, 10);
                }
            });
        }
        
        const state = Alpine.store('shell');

        // Define the scope for the Shell UI component (factory)
        globalThis.getShellScope = () => ({
            currentCommand: "",
            get history() { return state.history; },
            
            async executeCommand() {
                const cmd = this.currentCommand.trim();
                if (!cmd) return;
                
                state.addLog(cmd, 'input');
                state.commandHistory.push(cmd);
                state.historyIndex = state.commandHistory.length;
                this.currentCommand = "";
                
                try {
                    await this.processCommand(cmd);
                } catch (err) {
                    state.addLog(`Execution error: ${err.message}`, 'error');
                    if (logger) logger.error(`Shell Execution Error: ${err.message}`, err);
                    else console.error("Shell Execution Error:", err);
                }
            },
            
            async processCommand(input) {
                const parts = input.split(' ');
                const command = parts[0].toLowerCase();
                const args = parts.slice(1);
                
                try {
                    switch(command) {
                        case '/help':
                            state.addLog(`
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
                                    <div><span class="text-yellow-400">/install [url|${NEVERPLAYED_PREFIX}name]</span> - Install a new bundle</div>
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
                            state.history = [];
                            break;
                            
                        case '/reload-ui':
                            state.addLog("Forcing UI Reload...");
                            location.reload();
                            break;
                            
                        case '/whoami': {
                            const sessionRef = context.getServiceReference(SESSION_SERVICE);
                            const session = sessionRef ? context.getService(sessionRef) : null;
                            const user = session?.currentUser;
                            if (user) {
                                state.addLog(`Active User: <span class="text-white">${user.alias || user.email || user.firstname}</span> (ID: ${user.id})`);
                            } else {
                                state.addLog("No active session found.", 'error');
                            }
                            break;
                        }
                            
                        case '/vars': {
                            const boState = globalThis.backofficeState;
                            if (!boState) {
                                state.addLog("Backoffice state not found.", 'error');
                                return;
                            }

                            const categoryArg = args[0];
                            let targetArg = args[1]; // Can be ID or ID.PATH

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
                                state.addLog(`<div class="text-white font-bold">Variable Categories:</div>`);
                                Object.keys(categories).forEach(cat => {
                                    state.addLog(` - <span class="text-yellow-400">${cat}</span> (${categories[cat].data?.length || 0} items)`);
                                });
                                state.addLog(`<div class="opacity-50 text-[10px]">Usage: /vars [category|serviceId] [id][.path]</div>`);
                                return;
                            }

                            // 1. Resolve Data Source
                            let explicitMethodUsed = false;
                            let items = categories[categoryArg.toLowerCase()]?.data;
                            let label = categories[categoryArg.toLowerCase()]?.label || categoryArg;

                            if (items === undefined) {
                                // Try dynamic service lookup
                                const ref = context.getServiceReference(categoryArg);
                                if (ref) {
                                    const svc = context.getService(ref);
                                    
                                    // 1. EXPLICIT SELECTION: If targetArg is a method on the service
                                    if (targetArg && typeof svc[targetArg] === 'function') {
                                        try {
                                            const result = svc[targetArg]();
                                            if (Array.isArray(result)) {
                                                items = result;
                                                label = `${categoryArg}.${targetArg}()`;
                                                explicitMethodUsed = true;
                                                // Shift the "next" argument to be the new target (ID or Path)
                                                targetArg = args[2]; // The original targetArg was the method, so the next arg is the actual ID/Path
                                            }
                                        } catch (_e) {
                                            // Ignore evaluation errors
                                        }
                                    }

                                    // 2. REFINED HEURISTIC: Look for any "get*" that returns an array recursively
                                    if (!items) {
                                        let getter;
                                        let current = svc;
                                        while (current && current !== Object.prototype && !getter) {
                                            // Priority 1: Match the last part of service ID (e.g. getRules for rules.data)
                                            const targetBase = categoryArg.split('.').reverse().find(p => p !== 'data');
                                            const bestMatch = `get${targetBase?.charAt(0).toUpperCase()}${targetBase?.slice(1)}`;

                                            const allProps = Object.getOwnPropertyNames(current);
                                            if (allProps.includes(bestMatch) && typeof svc[bestMatch] === 'function') {
                                                getter = bestMatch;
                                            } else {
                                                getter = allProps.find(m => {
                                                    try {
                                                        return m.startsWith('get') && Array.isArray(svc[m]());
                                                    } catch (_e) { return false; }
                                                });
                                            }
                                            current = Object.getPrototypeOf(current);
                                        }
                                        
                                        if (getter) {
                                            items = svc[getter]();
                                            label = `${categoryArg}.${getter}()`;
                                        } else {
                                            items = [svc];
                                            label = `Service: ${categoryArg}`;
                                        }
                                    }
                                }
                            }

                            if (items === undefined) {
                                state.addLog(`No data source found for: ${categoryArg}`, 'error');
                                return;
                            }

                            // 2. Handle Listing
                            if (!targetArg) {
                                state.addLog(`<div class="text-white font-bold">${label}:</div>`);
                                if (items.length === 1 && items[0]?.id === undefined) {
                                    // Single service inspection
                                    state.addLog(`<pre class="text-[10px] text-emerald-400">${JSON.stringify(items[0], null, 2)}</pre>`);
                                } else {
                                    (items || []).forEach(item => {
                                        const methodSuffix = explicitMethodUsed ? ` ${args[1]}` : ""; // Use original args[1] for method name
                                        state.addLog(` - <span class="text-yellow-400 cursor-pointer" onclick="getShellScope().currentCommand='/vars ${categoryArg}${methodSuffix} ${item.id || ''}'; document.querySelector('[x-ref=\\'commandInput\\']').focus()">${item.id || '[no-id]'}</span>: ${item.name || item.label || item.firstname || '...'}`);
                                    });
                                }
                                return;
                            }

                            // 3. Resolve Target and Path (Dot Notation)
                            const [id, ...pathParts] = targetArg.split('.');
                            const path = pathParts.join('.');

                            const item = Array.isArray(items) 
                                ? items.find(i => String(i.id) === String(id) || (items.length === 1 && !i.id))
                                : items;

                            if (!item) {
                                state.addLog(`Item not found: ${id}`, 'error');
                                return;
                            }

                            let result = item;
                            if (path) {
                                result = path.split('.').reduce((obj, p) => obj?.[p], item);
                            }

                            if (result === undefined) {
                                state.addLog(`Path not found: ${path}`, 'error');
                                return;
                            }

                            state.addLog(`<div class="text-white font-bold">Inspect: ${label} / ${targetArg}</div>`);
                            state.addLog(`<pre class="text-[10px] text-emerald-400 overflow-x-auto">${JSON.stringify(result, null, 2)}</pre>`);
                            break;
                        }

                        case '/services': {
                            const filter = args[0]?.toLowerCase();
                            const refs = context.getServiceReferences?.(null, null) || [];
                            const serviceIds = new Set();
                            const detailedInfo = [];

                            refs.forEach(ref => {
                                const ocs = ref.getProperty("objectClass");
                                (Array.isArray(ocs) ? ocs : [ocs]).forEach(id => {
                                    if (!filter || id.toLowerCase().includes(filter)) {
                                        serviceIds.add(id);
                                        detailedInfo.push({ id, ref });
                                    }
                                });
                            });

                            const sortedIds = Array.from(serviceIds).sort();

                            if (sortedIds.length === 0) {
                                state.addLog(`No services found matching: ${filter || '*'}`, 'error');
                                return;
                            }

                            if (sortedIds.length === 1 && filter) {
                                const id = sortedIds[0];
                                const match = detailedInfo.find(d => d.id === id);
                                const bundle = match.ref.bundle;
                                const stateMap = { 1: 'UNINSTALLED', 2: 'INSTALLED', 4: 'RESOLVED', 8: 'STARTING', 16: 'STOPPING', 32: 'ACTIVE' };
                                
                                state.addLog(`<div class="text-white font-bold">Service Detail: ${id}</div>`);
                                state.addLog(`<div class="text-blue-200">Bundle: <span class="text-white">${bundle.getSymbolicName()}</span> (#${bundle.id}) [${stateMap[bundle.getState()] || bundle.getState()}]</div>`);
                                
                                const props = {};
                                match.ref.getPropertyKeys().forEach(k => {
                                    props[k] = match.ref.getProperty(k);
                                });
                                state.addLog(`<pre class="text-[10px] text-cyan-400">${JSON.stringify(props, null, 2)}</pre>`);
                            } else {
                                state.addLog(`<div class="text-white font-bold">Registered Services (${sortedIds.length}):</div>`);
                                sortedIds.forEach(id => {
                                    state.addLog(` - <span class="text-yellow-400 cursor-pointer" onclick="getShellScope().currentCommand='/services ${id}'; document.querySelector('[x-ref=\\'commandInput\\']').focus()">${id}</span>`);
                                });
                            }
                            break;
                        }

                        case '/bundles': {
                            const filterStr = args[0];
                            const allBundles = (context.getBundles?.() || []).sort((a,b) => b.id - a.id);
                            const stateMap = { 1: 'UNINSTALLED', 2: 'INSTALLED', 4: 'RESOLVED', 8: 'STARTING', 16: 'STOPPING', 32: 'ACTIVE' };
                            
                            let matched = allBundles;
                            if (filterStr) {
                                if (filterStr.startsWith('(')) {
                                    try {
                                        const f = context.createFilter?.(filterStr);
                                        const matchFn = f?.matches || f?.match;
                                        if (typeof matchFn === 'function') {
                                            matched = allBundles.filter(b => matchFn.call(f, b.getHeaders()));
                                        }
                                    } catch (err) {
                                        state.addLog(`Framework filter error: ${err.message}`, 'error');
                                        return;
                                    }
                                } else {
                                    const fs = filterStr.toLowerCase();
                                    matched = allBundles.filter(b => 
                                        String(b.id) === fs || 
                                        b.getSymbolicName().toLowerCase().includes(fs)
                                    );
                                }
                            } else {
                                matched = allBundles.filter(b => b.getState() !== 1);
                            }

                            if (matched.length === 0) {
                                state.addLog(`No active bundles found matching: ${filterStr || '*'}`, 'error');
                                return;
                            }

                            if (matched.length === 1 || (filterStr && matched.length > 0 && !isNaN(filterStr))) {
                                const b = matched[0];
                                state.addLog(`<div class="text-white font-bold">Bundle Detail: ${b.getSymbolicName() || 'unnamed'} (#${b.id})</div>`);
                                state.addLog(`<div class="text-blue-200">State: <span class="text-white font-bold">${stateMap[b.state] || b.state}</span></div>`);
                                
                                const bProps = [];
                                for (let obj = b; obj && obj !== Object.prototype; obj = Object.getPrototypeOf(obj)) {
                                    Object.getOwnPropertyNames(obj).forEach(k => {
                                        if (typeof b[k] !== 'function' && !bProps.includes(k)) bProps.push(k);
                                    });
                                }
                                bProps.forEach(k => {
                                    state.addLog(`<div class="text-blue-200">${k}: <span class="text-white text-[10px] break-all">${b[k]}</span></div>`);
                                });
                                
                                state.addLog(`<div class="text-white font-bold mt-2 underline">Manifest Headers:</div>`);
                                state.addLog(`<pre class="text-[10px] text-cyan-400">${JSON.stringify(b.getHeaders(), null, 2)}</pre>`);
                            } else {
                                state.addLog(`<div class="text-white font-bold">Universe Bundles (${matched.length}):</div>`);
                                matched.forEach(b => {
                                    const stateStr = stateMap[b.getState()] || b.getState();
                                    const colorClass = stateStr === 'ACTIVE' ? 'text-emerald-400' : 'text-yellow-400';
                                    state.addLog(` #${b.id} [<span class="${colorClass}">${stateStr}</span>] <span class="text-blue-400 cursor-pointer" onclick="getShellScope().currentCommand='/bundles ${b.id}'; document.querySelector('[x-ref=\\'commandInput\\']').focus()">${b.getSymbolicName()}</span>`);
                                });
                            }
                            break;
                        }

                        case '/methods': {
                            const serviceId = args[0];
                            if (!serviceId) {
                                state.addLog("Usage: /methods [serviceId]", 'error');
                                return;
                            }

                            const ref = context.getServiceReference(serviceId);
                            if (!ref) {
                                state.addLog(`Service not found: ${serviceId}`, 'error');
                                return;
                            }

                            const svc = context.getService(ref);
                            if (!svc) {
                                state.addLog(`Could not retrieve service: ${serviceId}`, 'error');
                                return;
                            }

                            const methods = new Set();
                            let current = svc;
                            const standardProto = Object.getOwnPropertyNames(Object.prototype);
                            
                            while (current && current !== Object.prototype) {
                                Object.getOwnPropertyNames(current).forEach(m => {
                                    if (typeof svc[m] === 'function' && m !== 'constructor' && !standardProto.includes(m)) {
                                        methods.add(m);
                                    }
                                });
                                current = Object.getPrototypeOf(current);
                            }

                            const sortedMethods = Array.from(methods).sort();

                            state.addLog(`<div class="text-white font-bold">Methods for: ${serviceId}</div>`);
                            if (sortedMethods.length === 0) {
                                state.addLog("No direct methods found.");
                            } else {
                                sortedMethods.forEach(m => {
                                    state.addLog(` - <span class="text-yellow-400 cursor-pointer" onclick="getShellScope().currentCommand='/vars ${serviceId} '; document.querySelector('[x-ref=\\'commandInput\\']').focus()">${m}()</span>`);
                                });
                            }
                            break;
                        }

                        case '/actions': {
                            const filter = args[0]?.toLowerCase();
                            const regRef = context.getServiceReference(ACTION_REGISTRY_SERVICE);
                            const registry = regRef ? context.getService(regRef) : null;
                            
                            if (!registry) {
                                state.addLog("Action Registry service not available.", 'error');
                                return;
                            }

                            const actions = registry.getActions().filter(a => !filter || a.id.toLowerCase().includes(filter));

                            if (actions.length === 0) {
                                state.addLog(`No actions found matching: ${filter || '*'}`, 'error');
                                return;
                            }

                            state.addLog(`<div class="text-white font-bold mb-2 underline">Action Registry (${actions.length} items):</div>`);
                            
                            actions.forEach(a => {
                                let paramDoc = "";
                                if (a.params && Object.keys(a.params).length > 0) {
                                    paramDoc = `<div class="ml-4 mt-1 space-y-1 opacity-75">
                                        ${Object.entries(a.params).map(([k, v]) => `
                                            <div class="flex gap-2">
                                                <span class="text-cyan-300 min-w-[100px] font-mono">${k}:</span>
                                                <span class="text-gray-300 italic">${v}</span>
                                            </div>
                                        `).join('')}
                                    </div>`;
                                }

                                state.addLog(`
                                    <div class="mb-3">
                                        <div class="flex gap-2 items-baseline">
                                            <span class="text-yellow-400 font-bold font-mono text-[11px]">${a.id}</span>
                                            <span class="text-white text-[10px] opacity-70">| ${a.label}</span>
                                        </div>
                                        <div class="text-[10px] text-gray-400 ml-4">${a.description}</div>
                                        ${paramDoc}
                                    </div>
                                `);
                            });
                            break;
                        }

                        case '/flows': {
                            const filter = args[0]?.toLowerCase();
                            const refs = context.getServiceReferences(FLOW_SERVICE, null) || [];
                            state.addLog(`<div class="text-white font-bold mb-2 underline">Registered Flows (${refs.length}):</div>`);
                            refs.forEach(ref => {
                                const id = ref.getProperty("flow.id") || "unknown";
                                const cap = ref.getProperty("capability") || "none";
                                if (!filter || id.toLowerCase().includes(filter) || cap.toLowerCase().includes(filter)) {
                                    state.addLog(` - <span class="text-yellow-400">${id}</span> <span class="text-gray-400 text-[10px]">[Cap: ${cap}]</span>`);
                                }
                            });
                            break;
                        }

                        case '/caps': {
                            const filter = args[0]?.toLowerCase();
                            const refs = context.getServiceReferences(FLOW_SERVICE, null) || [];
                            const caps = new Set();
                            refs.forEach(ref => {
                                const cap = ref.getProperty("capability");
                                if (cap) caps.add(cap);
                            });
                            
                            const sortedCaps = Array.from(caps).sort();
                            state.addLog(`<div class="text-white font-bold mb-2 underline">Global Capabilities (${sortedCaps.length}):</div>`);
                            sortedCaps.forEach(cap => {
                                if (!filter || cap.toLowerCase().includes(filter)) {
                                    state.addLog(` - <span class="text-cyan-400">${cap}</span>`);
                                }
                            });
                            break;
                        }

                        case '/start':
                        case '/stop':
                        case '/update':
                        case '/uninstall': {
                            const target = args[0];
                            if (!target) {
                                state.addLog(`Usage: ${command} [id|bsn]`, 'error');
                                return;
                            }

                            const targets = context.getBundles().filter(b => 
                                String(b.id) === target || b.getSymbolicName() === target
                            );

                            if (targets.length === 0) {
                                state.addLog(`Bundle not found: ${target}`, 'error');
                                return;
                            }

                            const action = command.slice(1);
                            
                            for (const b of targets) {
                                try {
                                    state.addLog(`${action.charAt(0).toUpperCase() + action.slice(1)}ing bundle ${b.getSymbolicName()} (#${b.id})...`);
                                    if (action === 'start') await b.start();
                                    else if (action === 'stop') await b.stop();
                                    else if (action === 'update') await b.update();
                                    else if (action === 'uninstall') await b.uninstall();
                                    state.addLog(`Success: Bundle ${b.getSymbolicName()} (#${b.id}) shifted to desired state.`);
                                } catch (err) {
                                    state.addLog(`Action failed for #${b.id}: ${err.message}`, 'error');
                                }
                            }
                            break;
                        }

                        case '/sidebar': {
                            const target = args[0];
                            const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                            const ca = caRef ? context.getService(caRef) : null;
                            if (!ca) {
                                state.addLog("Config Admin service not available.", 'error');
                                return;
                            }
                            const bundle = context.getBundles().find(b => String(b.id) === target || b.getSymbolicName() === target);
                            if (!bundle) {
                                state.addLog(`Bundle/Flow not found: ${target}`, 'error');
                                return;
                            }
                            const bsn = bundle.getSymbolicName();
                            const config = ca.getConfiguration(bsn);
                            const currentProps = config.getProperties() || {};
                            const newState = !currentProps.sidebar;
                            config.update({ ...currentProps, sidebar: newState });
                            state.addLog(`Sidebar visibility for ${bsn} set to: <b>${newState}</b>`);
                            state.addLog(`<span class="text-gray-400 italic">Hint: You may need to restart the bundle to apply changes.</span>`);
                            break;
                        }

                        case '/install': {

                            let url = args[0];
                            if (!url) {
                                state.addLog(`Usage: /install [url|${NEVERPLAYED_PREFIX}name]`, 'error');
                                return;
                            }
                            if (url.startsWith(NEVERPLAYED_PREFIX)) {
                                const name = url.replace(NEVERPLAYED_PREFIX, '');
                                url = `./bundles/org.neverplayed.${name}/manifest.json`;
                            }
                            const bustedUrl = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                            state.addLog(`Installing bundle from: <span class="text-white">${url}</span>...`);
                            try {
                                const b = await context.installBundle(bustedUrl);
                                state.addLog(`Success: Installed bundle #${b.id} (${b.getSymbolicName()})`);
                            } catch (err) {
                                state.addLog(`Installation failed: ${err.message}`, 'error');
                            }
                            break;
                        }
                            
                        case '/prime-all': {
                            const target = args[0];
                            const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                            const ca = caRef ? context.getService(caRef) : null;
                            if (!ca) return;

                            const bundles = context.getBundles().filter(b => {
                                const isActive = b.state === 32 || b.state === "ACTIVE";
                                if (!target) return isActive;
                                return isActive && (String(b.id) === target || b.getSymbolicName() === target);
                            });
                            
                            for (const b of bundles) {
                                const url = b.location || b.bundleLocation || b.manifestLocation || b.url;
                                if (!url) continue;
                                try {
                                    const manifest = await (await fetch(`${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`)).json();
                                    if (manifest.Configuration) ca.getConfiguration(b.getSymbolicName()).update(manifest.Configuration);
                                } catch (_e) {
                                    // Ignore failed unregistration
                                }
                            }
                            state.addLog(`Re-primed configurations.`);
                            break;
                        }

                        default:
                            state.addLog(`Unknown command: ${command}. Type /help for assistance.`, 'error');
                    }
                } catch (pErr) {
                    state.addLog(`Command Processing Error: ${pErr.message}`, 'error');
                }
            },
                
            navigateHistory(dir) {
                if (state.commandHistory.length === 0) return;
                state.historyIndex = Math.max(0, Math.min(state.commandHistory.length - 1, state.historyIndex + dir));
                this.currentCommand = state.commandHistory[state.historyIndex] || "";
            }
        });

        // Register the Flow Service
        context.registerService([FLOW_SERVICE, SHELL_CLI_SERVICE], {
            ...this.config,
            id: SHELL_CLI_PID,
            title: "Shell CLI",
            launch: (targetElement) => {

                targetElement.innerHTML = `
                    <div id="shell-container" class="h-full w-full">
                        <div class="h-full border border-blue-900 shadow-2xl rounded-xl overflow-hidden">
                            <div id="shell-content-wrapper" class="h-full">
                                <div class="h-full" x-html="await (await fetch('./bundles/org.neverplayed.shell-cli/templates/shell.html')).text()"></div>
                            </div>
                        </div>
                    </div>
                `;
            },
            processCommand: async (cmd) => {
                const scope = globalThis.getShellScope();
                if (scope) return await scope.processCommand(cmd);
                return "Shell scope not initialized.";
            },
            getCommands: () => {
                return ["/invite", "/clear", "/whoami", "/vars", "/services", "/bundles", "/loglevel", "/start", "/stop", "/update", "/uninstall", "/install", "/reset-config", "/prime-all", "/diag-manifest", "/reload-ui", "/methods", "/actions", "/flows", "/caps", "/help"];
            }
        }, {
            "capability": "sys:cli", "flow.id": SHELL_CLI_PID,
            "flowType": BUNDLE_TYPE_SERVICE,
            "sidebar": true,
            "icon": "fas fa-terminal",
            "channels": ["real-life", "business-portal", "web-browser", "business-channel-web", "business-channel-app", "retail-channel-app"]
        });
    }

    stop(_context) {}
}
