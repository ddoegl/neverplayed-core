import { 
    NEVERPLAYED_PREFIX, 
    SHELL_CLI_SERVICE,
    SHELL_COMMAND_SERVICE,
    FLOW_SERVICE,
    SESSION_SERVICE
} from "core-types";
import { CoreActivator } from "osgi-base";

const CORE_COMMANDS = [
    { name: 'help', description: 'Show this help text' },
    { name: 'clear', description: 'Clear shell history' },
    { name: 'reload-ui', description: 'Reload the browser page' },
    { name: 'services', description: '[filter] - List registered services' },
    { name: 'bundles', description: '[filter] - List universe bundles' },
    { name: 'methods', description: '[serviceId] - List methods of a service' },
    { name: 'flows', description: '[filter] - List registered UI flows' },
    { name: 'caps', description: 'List active system capabilities' },
    { name: 'auth', description: 'Show current authentication state (whoami)' },
    { name: 'call', description: '[serviceId] [method] [args...] - Call a service method' },
    { name: 'install', description: '[url] - Install a new bundle' },
    { name: 'uninstall', description: '[id/bsn] - Uninstall a bundle' },
    { name: 'start', description: '[id/bsn] - Start a bundle' },
    { name: 'stop', description: '[id/bsn] - Stop a bundle' },
    { name: 'update', description: '[id/bsn] - Update a bundle' },
    { name: 'props', description: '[serviceId] - List OSGi service properties' }
];

export default class Activator extends CoreActivator {
    onCoreStart(context) {
        this.history = [];
        this.logCounter = 0;
        this.listeners = new Set();
        this.commands = new Map();

        const shellService = {
            execute: (input) => this.handleCommand(input, context),
            subscribe: (listener) => {
                this.listeners.add(listener);
                return () => this.listeners.delete(listener);
            },
            getHistory: () => [...this.history],
            getCommands: () => [
                ...CORE_COMMANDS.map(c => `/${c.name}`),
                ...Array.from(this.commands.keys()).map(name => `/${name}`)
            ].sort()
        };

        context.trackService(`(objectClass=${SHELL_COMMAND_SERVICE})`, {
            addingService: (_ref) => {
                const cmd = context.getService(_ref);
                if (cmd && cmd.name) {
                    this.commands.set(cmd.name, cmd);
                }
                return cmd;
            },
            removedService: (_ref, cmd) => {
                if (cmd && cmd.name) {
                    this.commands.delete(cmd.name);
                }
            }
        }).open();

        context.registerService(SHELL_CLI_SERVICE, shellService);
    }

    log(content, type = 'output') {
        const entry = { 
            id: ++this.logCounter,
            timestamp: Date.now(), 
            type, 
            content 
        };
        this.history.push(entry);
        
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            } catch (_err) { /* ignore */ }
        });

        if (this.isHeadless) {
            let cleanLog = content;
            if (typeof content === 'object' && content !== null) {
                if (content.text) cleanLog = content.text;
                else try { cleanLog = JSON.stringify(content, null, 2); } catch (_e) { cleanLog = '[Object]'; }
            }
            if (type === 'error') this.logger.error(`[SHELL] ${cleanLog}`);
            else this.logger.debug(`[SHELL] ${cleanLog}`);
        }
    }

    resolveServiceRef(idOrName, context) {
        if (!idOrName) return null;
        
        // 1. Try numeric ID
        if (/^\d+$/.test(idOrName)) {
            const refs = context.getServiceReferences(null, `(service.id=${idOrName})`);
            if (refs && refs.length > 0) return refs[0];
        }

        // 2. Try standard OSGi (objectClass or filter)
        try {
            return context.getServiceReference(idOrName);
        } catch (_e) {
            // Might be a filter that needs getServiceReferences
            const refs = context.getServiceReferences(null, idOrName);
            if (refs && refs.length > 0) return refs[0];
        }
        return null;
    }

    async handleCommand(input, context) {
        const parts = input.trim().split(/\s+/);
        const commandLine = parts[0].toLowerCase();
        const command = commandLine.startsWith('/') ? commandLine.slice(1) : commandLine;
        const args = parts.slice(1);
        
        try {
            // Check dynamic commands first
            if (this.commands.has(command)) {
                await this.commands.get(command).execute(args, context, (msg, type) => this.log(msg, type));
                return;
            }

            // Core internal commands
            switch(command) {
                case 'help':
                    this.renderHelp();
                    break;
                    
                case 'clear':
                    this.history = [];
                    this.listeners.forEach(l => l({ type: 'clear' })); 
                    break;
                    
                case 'reload-ui':
                    if (globalThis.location) globalThis.location.reload();
                    break;

                case 'services': {
                    const filter = args[0]?.toLowerCase();
                    const refs = context.getServiceReferences(null, null) || [];
                    
                    this.log(`Registered Services (${refs.length}):`);
                    refs.sort((a,b) => a.getProperty("service.id") - b.getProperty("service.id")).forEach(ref => {
                        const id = ref.getProperty("service.id");
                        const classes = ref.getProperty("objectClass");
                        const name = Array.isArray(classes) ? classes.join(', ') : classes;
                        
                        if (!filter || name.toLowerCase().includes(filter)) {
                            this.log(` #${id.toString().padEnd(3)} ${name}`);
                        }
                    });
                    break;
                }

                case 'bundles': {
                    const filterStr = args[0];
                    const allBundles = context.getBundles().sort((a,b) => a.id - b.id);
                    const stateMap = { 1: 'UNINSTALLED', 2: 'INSTALLED', 4: 'RESOLVED', 8: 'STARTING', 16: 'STOPPING', 32: 'ACTIVE' };
                    
                    let matched = allBundles.filter(b => b.getState() !== 1);
                    if (filterStr) {
                        const fs = filterStr.toLowerCase();
                        matched = matched.filter(b => String(b.id) === fs || b.getSymbolicName().toLowerCase().includes(fs));
                    }

                    if (matched.length === 1) {
                        const b = matched[0];
                        const headers = b.getHeaders() || {};
                        const stateStr = stateMap[b.getState()] || b.getState();
                        
                        this.log({ text: `Details for Bundle #${b.id}:`, color: 'blue', bold: true });
                        this.log({ text: ` - SymbolicName: ${b.getSymbolicName()}`, color: 'cyan' });
                        this.log(` - State: ${stateStr}`);
                        
                        const regSvc = b.getRegisteredServices() || [];
                        if (regSvc.length > 0) {
                            this.log({ text: ` Registered Services:`, color: 'yellow' });
                            regSvc.forEach(ref => {
                                const names = ref.getProperty("objectClass");
                                this.log(`   - ${Array.isArray(names) ? names.join(', ') : names}`);
                            });
                        }

                        const allRefs = context.getServiceReferences(null, null) || [];
                        const useSvc = allRefs.filter(ref => {
                            const using = ref.getUsingBundles() || [];
                            return using.some(ub => ub.getSymbolicName() === b.getSymbolicName());
                        });

                        if (useSvc.length > 0) {
                            this.log({ text: ` Services In Use:`, color: 'yellow' });
                            useSvc.forEach(ref => {
                                const names = ref.getProperty("objectClass");
                                this.log(`   - ${Array.isArray(names) ? names.join(', ') : names}`);
                            });
                        }

                        this.log({ text: ` Manifest Headers:`, color: 'gray' });
                        Object.entries(headers).forEach(([k, v]) => {
                            if (typeof v === 'object') v = JSON.stringify(v);
                            this.log(`   - ${k}: ${v}`);
                        });
                    } else {
                        this.log({ text: `Universe Bundles (${matched.length}):`, color: 'blue', bold: true });
                        matched.forEach(b => {
                            const stateStr = stateMap[b.getState()] || b.getState();
                            this.log(` #${b.id.toString().padEnd(3)} [${stateStr.padEnd(10)}] ${b.getSymbolicName()}`);
                        });
                    }
                    break;
                }

                case 'props': {
                    const serviceId = args[0];
                    if (!serviceId) {
                        this.log("Usage: /props [serviceId]", 'error');
                        return;
                    }
                    const ref = this.resolveServiceRef(serviceId, context);
                    if (!ref) {
                        this.log(` Service not found: ${serviceId}`, 'error');
                        return;
                    }

                    const keys = ref.getPropertyKeys() || [];
                    this.log(`OSGi Properties for ${serviceId}:`);
                    keys.sort().forEach(key => {
                        let val = ref.getProperty(key);
                        if (typeof val === 'object' && val !== null) {
                            try { val = JSON.stringify(val); } catch (_e) { val = '{...}'; }
                        }
                        this.log(` - ${key}: ${val}`);
                    });
                    break;
                }

                case 'methods': {
                    const serviceId = args[0];
                    if (!serviceId) {
                        this.log("Usage: /methods [serviceId]", 'error');
                        return;
                    }
                    const ref = this.resolveServiceRef(serviceId, context);
                    if (!ref) {
                        this.log(` Service not found: ${serviceId}`, 'error');
                        return;
                    }
                    const svc = context.getService(ref);
                    
                    let propertyNames = [];
                    let current = svc;
                    while (current && current !== Object.prototype) {
                        propertyNames = propertyNames.concat(Object.getOwnPropertyNames(current));
                        current = Object.getPrototypeOf(current);
                    }

                    const internalJSMethods = [
                        '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', 
                        'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toString', 
                        'toLocaleString', 'valueOf', 'constructor'
                    ];

                    const allProps = [...new Set(propertyNames)].filter(p => !internalJSMethods.includes(p));
                    const methods = allProps.filter(m => typeof svc[m] === 'function').sort();
                    const data = allProps.filter(p => typeof svc[p] !== 'function').sort();

                    if (methods.length > 0) {
                        this.log(`Methods for ${serviceId}:`);
                        methods.forEach(m => this.log(` - ${m}()`));
                    }
                    
                    if (data.length > 0) {
                        this.log(`Data Properties for ${serviceId}:`);
                        data.forEach(p => {
                            let val = svc[p];
                            if (typeof val === 'object' && val !== null) {
                                try { val = JSON.stringify(val); } catch (_e) { val = '{...}'; }
                            }
                            this.log(` - ${p}: ${val}`);
                        });
                    }
                    break;
                }

                case 'call': {
                    // Security Guard
                    if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                        this.log("Access Denied: Admin attributes required for /call.", 'error');
                        return;
                    }

                    const [serviceId, methodName, ...callArgs] = args;
                    if (!serviceId || !methodName) {
                        this.log("Usage: /call [serviceId] [methodName] [args...]", 'error');
                        return;
                    }
                    const ref = this.resolveServiceRef(serviceId, context);
                    if (!ref) {
                        this.log(` Service not found: ${serviceId}`, 'error');
                        return;
                    }
                    const svc = context.getService(ref);
                    if (typeof svc[methodName] !== 'function') {
                        this.log(` Method not found or not a function: ${methodName}`, 'error');
                        return;
                    }

                    try {
                        const parsedArgs = callArgs.map(arg => {
                            try { return JSON.parse(arg); } catch (_e) { return arg; }
                        });
                        const result = await svc[methodName](...parsedArgs);
                        this.log(`Result:`);
                        this.log(result);
                    } catch (err) {
                        this.log(`Execution failed: ${err.message}`, 'error');
                    }
                    break;
                }

                case 'flows': {
                    const filter = args[0]?.toLowerCase();
                    const refs = context.getServiceReferences(FLOW_SERVICE, null) || [];
                    this.log(`Registered Flows (${refs.length}):`);
                    refs.forEach(ref => {
                        const id = ref.getProperty("flow.id") || "unknown";
                        const cap = ref.getProperty("capability") || "none";
                        if (!filter || id.toLowerCase().includes(filter) || cap.toLowerCase().includes(filter)) {
                            this.log(` - ${id} [Cap: ${cap}]`);
                        }
                    });
                    break;
                }

                case 'caps': {
                    const refs = context.getServiceReferences(null, null) || [];
                    const caps = [...new Set(refs.map(r => r.getProperty("capability")).filter(c => typeof c === 'string' && c !== 'none'))].sort();
                    this.log({ text: `Active Capabilities (${caps.length}):`, color: 'blue', bold: true });
                    caps.forEach(c => this.log({ text: ` - ${c}`, color: 'cyan' }));
                    break;
                }

                case 'whoami':
                case 'auth': {
                    const sessionRef = context.getServiceReference(SESSION_SERVICE);
                    if (!sessionRef) {
                        this.log("Session Service not found.", 'error');
                        return;
                    }
                    const session = context.getService(sessionRef);
                    const user = session.currentUser;
                    
                    if (!user || user.id === 'guest') {
                        this.log({ text: "Status: Unauthenticated (Guest)", color: 'yellow', bold: true });
                        this.log("No active user session detected.");
                    } else {
                        this.log({ text: `Status: Authenticated as ${user.alias || user.id}`, color: 'green', bold: true });
                        this.log({ text: "Session Properties:", color: 'cyan' });
                        this.log({
                            id: user.id,
                            email: user.email,
                            firstname: user.firstname,
                            lastname: user.lastname,
                            capabilities: user.capabilities || [],
                            attributes: user.attributes || {}
                        });
                    }
                    break;
                }

                case 'start':
                case 'stop':
                case 'update':
                case 'uninstall': {
                    // Security Guard
                    if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                        this.log(`Access Denied: Admin attributes required for /${command}.`, 'error');
                        return;
                    }

                    const target = args[0];
                    if (!target) return;
                    const targets = context.getBundles().filter(b => String(b.id) === target || b.getSymbolicName() === target);
                    for (const b of targets) {
                         try {
                            if (command === 'start') await b.start();
                            else if (command === 'stop') await b.stop();
                            else if (command === 'update') await b.update();
                            else if (command === 'uninstall') await b.uninstall();
                            this.log(`Success: ${command} ${b.getSymbolicName()}`);
                        } catch (err) { this.log(`Action failed: ${err.message}`, 'error'); }
                    }
                    break;
                }

                case 'install': {
                    // Security Guard
                    if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                        this.log("Access Denied: Admin attributes required for /install.", 'error');
                        return;
                    }

                    let url = args[0];
                    if (!url) return;
                    if (url.startsWith(NEVERPLAYED_PREFIX)) {
                        try {
                            const base = globalThis.NEVERPLAYED_BASE_URL || globalThis.location?.href || './';
                            const name = url.replace(NEVERPLAYED_PREFIX, '');
                            url = new URL(`./bundles/org.neverplayed.${name}/manifest.json`, base).href;
                        } catch (_e) { 
                            const name = url.replace(NEVERPLAYED_PREFIX, '');
                            url = `./bundles/org.neverplayed.${name}/manifest.json`; 
                        }
                    }
                    try {
                        const b = await context.installBundle(url);
                        this.log(`Success: Installed bundle #${b.id} (${b.getSymbolicName()})`);
                        if (b.getState() < 32) await b.start();
                    } catch (err) { this.log(`Installation failed: ${err.message}`, 'error'); }
                    break;
                }

                default:
                    this.log(`Unknown command: ${command}. Type /help for assistance.`, 'error');
            }
        } catch (pErr) {
            this.log(`Command Processing Error: ${pErr.message}`, 'error');
        }
    }

    renderHelp() {
        this.log({ text: "Available Commands:", color: 'blue', bold: true });
        CORE_COMMANDS.forEach(cmd => {
            this.log({ text: ` /${cmd.name.padEnd(12)}`, color: 'cyan', bold: true });
            this.log({ text: `  ${cmd.description || ''}`, color: 'gray' });
        });
        
        if (this.commands.size > 0) {
            this.log({ text: "Extensions:", color: 'magenta', bold: true });
            Array.from(this.commands.values()).forEach(cmd => {
                this.log({ text: ` /${cmd.name.padEnd(12)}`, color: 'cyan', bold: true });
                this.log({ text: `  ${cmd.description || ''}`, color: 'gray' });
            });
        }
    }

    onCoreStop() {}
}
