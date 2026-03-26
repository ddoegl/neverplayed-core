import { FLOW_SERVICE, SELECTION_SERVICE, CONFIG_ADMIN_SERVICE, ACTION_REGISTRY_SERVICE, LOG_SERVICE, SESSION_SERVICE, BUNDLE_TYPE_SERVICE, LOG_LEVEL_PROP, NEVERPLAYED_PREFIX, SHELL_CLI_PID, SHELL_CLI_SERVICE } from "core-types";
import { sendInvitationRequest } from "../../auth-shield.js";

// Using globalThis.Alpine as guaranteed by index.html loader
const Alpine = globalThis.Alpine;

export default class Activator {
    start(context) {
        let logger = null;
        
        // Track LogService for standardized logging
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                logger.info("Log Service connected");
            },
            removedService: () => { logger = null; }
        }).open();

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
        } else {
            // Migration for legacy state without timestamps
            const s = Alpine.store('shell');
            s.history?.forEach(log => {
                if (!log.timestamp) log.timestamp = Date.now() + Math.random();
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
                            // Standard OSGi: getServiceReferences returns all if no filter
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
                                // Show details if only one was found and a filter was provided
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
                            const allBundles = (context.getBundles?.() || []).sort((a,b) => b.id - a.id); // Newest first
                            const stateMap = { 1: 'UNINSTALLED', 2: 'INSTALLED', 4: 'RESOLVED', 8: 'STARTING', 16: 'STOPPING', 32: 'ACTIVE' };
                            
                            let matched = allBundles;
                            if (filterStr) {
                                if (filterStr.startsWith('(')) {
                                    // 1. LDAP FILTER (Full evaluator if available)
                                    try {
                                        const f = context.createFilter?.(filterStr);
                                        const matchFn = f?.matches || f?.match;
                                        if (typeof matchFn === 'function') {
                                           const _filterObj = f;
                                        matched = allBundles.filter(b => matchFn.call(f, b.getHeaders()));
                                        }
                                    } catch (err) {
                                        state.addLog(`Framework filter error: ${err.message}`, 'error');
                                        return;
                                    }
                                } else {
                                    // 2. Simple text filter
                                    const fs = filterStr.toLowerCase();
                                    matched = allBundles.filter(b => 
                                        String(b.id) === fs || 
                                        b.getSymbolicName().toLowerCase().includes(fs)
                                    );
                                }
                            } else {
                                // Default: Hide UNINSTALLED unless explicitly requested
                                matched = allBundles.filter(b => b.getState() !== 1);
                            }

                            if (matched.length === 0) {
                                state.addLog(`No active bundles found matching: ${filterStr || '*'}`, 'error');
                                return;
                            }

                            if (matched.length === 1 || (filterStr && matched.length > 0 && !isNaN(filterStr))) {
                                const b = matched[0]; // If filter was an ID, take the first one (highest ID as per sort)
                                state.addLog(`<div class="text-white font-bold">Bundle Detail: ${b.getSymbolicName() || 'unnamed'} (#${b.id})</div>`);
                                state.addLog(`<div class="text-blue-200">State: <span class="text-white font-bold">${stateMap[b.state] || b.state}</span></div>`);
                                
                                // Inspect all bundle properties (recursive prototype traversal for getters)
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
                                
                                // 1. Provided Services
                                try {
                                    const refs = b.getRegisteredServices?.() || [];
                                    if (refs.length > 0) {
                                        state.addLog(`<div class="text-white font-bold mt-2 underline">Provided Services:</div>`);
                                        refs.forEach(r => {
                                            state.addLog(` - ${r.getProperty('objectClass')}`);
                                        });
                                    }
                                } catch (_e) {
                                    // Ignored
                                }
                                // 2. Consumed Services
                                try {
                                    const usedRefs = b.getServicesInUse?.() || [];
                                    if (usedRefs.length > 0) {
                                        state.addLog(`<div class="text-white font-bold mt-2 underline">Consumed Services:</div>`);
                                        usedRefs.forEach(r => {
                                            state.addLog(` - ${r.getProperty('objectClass')}`);
                                        });
                                    }
                                } catch (_e) {
                                    // Ignored
                                }
                            } else {
                                state.addLog(`<div class="text-white font-bold">Universe Bundles (${matched.length}):</div>`);
                                matched.forEach(b => {
                                    const stateStr = stateMap[b.getState()] || b.getState();
                                    const colorClass = stateStr === 'ACTIVE' ? 'text-emerald-400' : 'text-yellow-400';
                                    state.addLog(` #${b.id} [<span class="${colorClass}">${stateStr}</span>] <span class="text-blue-400 cursor-pointer" onclick="getShellScope().currentCommand='/bundles ${b.id}'; document.querySelector('[x-ref=\\'commandInput\\']').focus()">${b.getSymbolicName()}</span>`);
                                });
                                state.addLog(`<div class="opacity-50 text-[10px]">Usage: /bundles [id|bsn|ldap] for details</div>`);
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

                            // Collect ALL methods from the whole prototype chain
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
                                state.addLog("No direct methods found (might be a plain object).");
                                state.addLog(`<pre class="text-[10px] text-emerald-400">${JSON.stringify(svc, null, 2)}</pre>`);
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

                            const action = command.slice(1); // 'start', 'stop', etc.
                            
                            for (const b of targets) {
                                try {
                                    state.addLog(`${action.charAt(0).toUpperCase() + action.slice(1)}ing bundle ${b.getSymbolicName()} (#${b.id})...`);
                                    
                                    // Perform OSGi lifecycle action with timeout protection
                                    const timeoutPromise = new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error(`${action} timed out after 5s`)), 5000)
                                    );

                                    if (action === 'start') await Promise.race([b.start(), timeoutPromise]);
                                    else if (action === 'stop') await Promise.race([b.stop(), timeoutPromise]);
                                    else if (action === 'update') await Promise.race([b.update(), timeoutPromise]);
                                    else if (action === 'uninstall') await Promise.race([b.uninstall(), timeoutPromise]);
                                    
                                    state.addLog(`Success: Bundle ${b.getSymbolicName()} (#${b.id}) shifted to desired state.`);
                                } catch (err) {
                                    state.addLog(`Action failed for #${b.id}: ${err.message}`, 'error');
                                }
                            }
                            break;
                        }

                        case '/install': {
                            let url = args[0];
                            if (!url) {
                                state.addLog(`Usage: /install [url|${NEVERPLAYED_PREFIX}name]`, 'error');
                                return;
                            }

                            // Shortcut for @neverplayed bundles
                            if (url.startsWith(NEVERPLAYED_PREFIX)) {
                                const name = url.replace(NEVERPLAYED_PREFIX, '');
                                url = `./bundles/org.neverplayed.${name}/manifest.json`;
                            }

                            // Add cache-buster to ensure we don't pick up stale manifest/activator
                            const separator = url.includes('?') ? '&' : '?';
                            const bustedUrl = `${url}${separator}cb=${Date.now()}`;

                            state.addLog(`Installing bundle from: <span class="text-white">${url}</span>...`);
                            try {
                                const b = await context.installBundle(bustedUrl);
                                state.addLog(`Success: Installed bundle #${b.id} (${b.getSymbolicName()})`);
                                state.addLog(`<div class="opacity-50 text-[10px]">Note: Use /start ${b.id} to activate it.</div>`);
                            } catch (err) {
                                state.addLog(`Installation failed: ${err.message}`, 'error');
                            }
                            break;
                        }
                            
                        case '/prime-all': {
                            const target = args[0];
                            state.addLog(`Forcing manifest re-prime for: ${target || 'all active bundles'}...`);
                            
                            const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                            const ca = caRef ? context.getService(caRef) : null;
                            if (!ca) {
                                state.addLog("ConfigAdmin service not found!", 'error');
                                return;
                            }

                            const bundles = context.getBundles().filter(b => {
                                const isActive = b.state === 32 || b.state === "ACTIVE";
                                if (!target) return isActive;
                                return isActive && (String(b.id) === target || b.getSymbolicName() === target);
                            });
                            
                            let count = 0;
                            for (const b of bundles) {
                                // Pandino uses various properties for the source location
                                const url = b.manifestLocation || b.manifesLocation || b.bundleLocation || b.location || b.url;
                                const bsn = b.getSymbolicName();
                                
                                if (!url) {
                                    state.addLog(`<span class="opacity-50">[Skip] ${bsn}: No source URL found.</span>`);
                                    continue;
                                }
                                
                                try {
                                    const bustedUrl = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                                    const response = await fetch(bustedUrl, { cache: 'reload' });
                                    if (response.ok) {
                                        const manifest = await response.json();
                                        const configData = manifest.Configuration;
                                        if (configData) {
                                            const cfg = ca.getConfiguration(bsn);
                                            cfg.update(configData);
                                            state.addLog(`Re-primed config for: <span class="text-emerald-400 font-bold">${bsn}</span>`);
                                            count++;
                                        }
                                    } else {
                                        state.addLog(`<span class="opacity-50 text-red-400">[Fail] ${bsn}: HTTP ${response.status} at ${url}</span>`);
                                    }
                                } catch (err) {
                                    state.addLog(`<span class="opacity-50 text-red-400">[Error] ${bsn}: ${err.message}</span>`);
                                }
                            }
                            state.addLog(`<div class="text-white font-bold mt-2">Final: Re-primed ${count} bundles.</div>`);
                            break;
                        }

                        case '/diag-manifest': {
                            const target = args[0];
                            if (!target) {
                                state.addLog("Usage: /diag-manifest [id|bsn|url]", 'error');
                                return;
                            }
                            
                            let url = target;
                            const b = context.getBundles().find(b => String(b.id) === target || b.getSymbolicName() === target);
                            if (b) {
                                url = b.location || b.bundleLocation || b.manifestLocation || b.url || target;
                            }
                            
                            // Add forced cache-buster
                            const separator = url.includes('?') ? '&' : '?';
                            const bustedUrl = `${url}${separator}cb=${Date.now()}`;
                            
                            state.addLog(`Performing direct manifest fetch for: <span class="text-white">${url}</span>...`);
                            try {
                                const response = await fetch(bustedUrl, { cache: 'reload' });
                                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                const text = await response.text();
                                state.addLog(`<div class="text-white font-bold underline mt-2">Remote Manifest (Direct Fetch):</div>`);
                                state.addLog(`<pre class="text-[10px] text-cyan-400 overflow-x-auto">${text}</pre>`);
                            } catch (err) {
                                state.addLog(`Fetch failed: ${err.message}`, 'error');
                            }
                            break;
                        }
                            
                        case '/reset-config': {
                            const pid = args[0];
                            if (!pid) {
                                state.addLog("Usage: /reset-config [pid|bsn]", 'error');
                                return;
                            }
                            state.addLog(`Resetting configuration for: <span class="text-white">${pid}</span>...`);
                            // ConfigAdmin uses 'config.' prefix in PersistenceManager (which uses localStorage)
                            localStorage.removeItem(`config.${pid}`);
                            state.addLog(`Success: Persistent configuration cleared. <div class="opacity-50 text-[10px]">Note: You may need to /update or /start the bundle to re-prime from manifest.</div>`);
                            break;
                        }
                            
                        case '/invite': {
                            if (!args[0]) {
                                state.addLog("Usage: /invite [email]", 'error');
                                return;
                            }
                            state.addLog(`Initializing invitation for <span class="text-white">${args[0]}</span>...`);
                            try {
                                const result = await sendInvitationRequest(args[0]);
                                if (result.success) {
                                    state.addLog(`Success! Fellowship invitation sent to ${args[0]}.`, 'success');
                                    state.addLog(`Message ID: <span class="opacity-50 text-[10px]">${result.messageId}</span>`);
                                } else {
                                    state.addLog(`Failed: ${result.message || 'Unknown error'}`, 'error');
                                }
                            } catch (err) {
                                state.addLog(`System Error: ${err.message}`, 'error');
                            }
                            break;
                        }
                            
                        case '/loglevel': {
                            const level = args[0]?.toUpperCase();
                            const targetStr = args[1];
                            const validLevels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];

                            if (!level || !targetStr) {
                                state.addLog("Usage: /loglevel [level] [id,bsn,...]", 'error');
                                state.addLog("Example: /loglevel DEBUG 1,2,neverplayed.limes");
                                return;
                            }

                            if (!validLevels.includes(level)) {
                                state.addLog(`Invalid level: ${level}. Use: ${validLevels.join(', ')}`, 'error');
                                return;
                            }

                            const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                            const ca = caRef ? context.getService(caRef) : null;
                            if (!ca) {
                                state.addLog("ConfigAdmin service not found!", 'error');
                                return;
                            }

                            const ids = targetStr.split(',');
                            let updatedCount = 0;

                            for (const id of ids) {
                                const target = id.trim();
                                // Resolve to PID (BSN)
                                const bundle = context.getBundles().find(b => 
                                    String(b.id) === target || b.getSymbolicName() === target
                                );
                                
                                const pid = bundle ? bundle.getSymbolicName() : target;
                                
                                try {
                                    const cfg = ca.getConfiguration(pid);
                                    cfg.update({ [LOG_LEVEL_PROP]: level });
                                    state.addLog(`Set log-level: <span class="text-white font-bold">${level}</span> for <span class="text-yellow-400">${pid}</span>`);
                                    updatedCount++;
                                } catch (err) {
                                    state.addLog(`Failed to update ${pid}: ${err.message}`, 'error');
                                }
                            }
                            state.addLog(`<div class="text-white font-bold mt-1">Status: ${updatedCount} log levels updated.</div>`);
                            break;
                        }

                        default:
                            state.addLog(`Unknown command: ${command}. Type /help for assistance.`, 'error');
                    }
                } catch (pErr) {
                    state.addLog(`Command Processing Error: ${pErr.message}`, 'error');
                    if (logger) logger.error(`Shell CLI Error: ${pErr.message}`, pErr);
                    else console.error("Shell CLI Error:", pErr);
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
                return ["/invite", "/clear", "/whoami", "/vars", "/services", "/bundles", "/loglevel", "/start", "/stop", "/update", "/uninstall", "/install", "/reset-config", "/prime-all", "/diag-manifest", "/reload-ui", "/methods", "/actions", "/help"];
            }
        }, {
            "capability": "sys:cli", "flow.id": SHELL_CLI_PID,
            "flowType": BUNDLE_TYPE_SERVICE,
            "channels": ["real-life", "business-portal", "web-browser", "business-channel-web", "business-channel-app", "retail-channel-app"]
        });
    }

    stop(_context) {
        if (logger) logger.info("Bundle stopped.");
    }
}
