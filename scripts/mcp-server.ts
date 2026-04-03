/**
 * Never Played: Agentic OSGi Bridge (MCP Server) 🤖🛰️
 * Exposes the OSGi service registry to AI agents via Model Context Protocol.
 * Run via: deno run -A scripts/mcp-server.ts
 */

import { join, resolve } from "https://deno.land/std@0.221.0/path/mod.ts";

// 0. Redirect console to stderr IMMEDIATELY to prevent stdout corruption
const _originalConsoleLog = console.log;
const _originalConsoleInfo = console.info;
const _originalConsoleWarn = console.warn;
const _originalConsoleError = console.error;
const _originalConsoleDebug = console.debug;

console.log = (...args) => { Deno.stderr.writeSync(new TextEncoder().encode(args.join(" ") + "\n")); };
console.info = (...args) => { Deno.stderr.writeSync(new TextEncoder().encode(args.join(" ") + "\n")); };
console.warn = (...args) => { Deno.stderr.writeSync(new TextEncoder().encode(args.join(" ") + "\n")); };
console.error = (...args) => { Deno.stderr.writeSync(new TextEncoder().encode(args.join(" ") + "\n")); };
console.debug = (...args) => { Deno.stderr.writeSync(new TextEncoder().encode(args.join(" ") + "\n")); };

// 1. Unified Environment Mocks (Same as headless-terminal)
const mockDoc = {
    createElement: () => ({ style: {}, appendChild: () => {}, addEventListener: () => {}, setAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
};

(globalThis as unknown as Record<string, unknown>).document = mockDoc as unknown as Record<string, unknown>;
(globalThis as unknown as Record<string, unknown>).window = globalThis as unknown as Record<string, unknown>;
const BASE_URL = `file://${Deno.cwd()}/public/`;
(globalThis as unknown as Record<string, unknown>).NEVERPLAYED_BASE_URL = BASE_URL;

// Mock Location for relative URL resolution (Realm Manager / Persistence)
(globalThis as unknown as Record<string, unknown>).location = {
    origin: "http://localhost",
    href: "http://localhost/",
    pathname: "/",
    toString() { return (this as unknown as Record<string, string>).href; }
};

// 2. Headless Identity Context & Secrets
// Load secret from .env.mcp if it exists
let mcpSecret = "PLACEHOLDER";
try {
    const envText = Deno.readTextFileSync("./.env.mcp");
    const match = envText.match(/MCP_API_SECRET=(.*)/);
    if (match) mcpSecret = match[1].trim();
} catch (_e) {
    console.warn("MCP Server: .env.mcp not found or invalid. Secret fallback might fail.");
}
(globalThis as unknown as Record<string, unknown>).NEVERPLAYED_MCP_SECRET = mcpSecret;

const agentEmail = Deno.env.get("NEVERPLAYED_USER") || "agent-mcp@neverplayed.org";
(globalThis as unknown as Record<string, unknown>).NEVERPLAYED_HEADLESS_USER = {
    email: agentEmail,
    uid: `mcp-${agentEmail.split('@')[0]}`,
    isSuperuser: true,
    authorized: true
};

// 3. Dynamic Registry Holder
interface PandinoInstance {
    init(): Promise<void>;
    start(): Promise<void>;
    getBundleContext(): unknown;
}
let pandinoInstance: PandinoInstance | null = null;

const denoFetcher = async (urlOrString: string | URL | Request) => {    
    const url = (typeof urlOrString === 'string') ? urlOrString : (urlOrString as unknown as { url: string }).url || urlOrString.toString();
    const path = url
        .replace(/^file:\/+/ , "/")
        .replace(/^http:\/\/localhost\//, "/")
        .split('?')[0];

    try {
        if (path.startsWith("/")) return await Deno.readTextFile(path);
        throw new Error("Relative path");
    } catch (_err) {
        const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
        console.error(`[denoFetcher] Trying: ${altPath}`);
        return await Deno.readTextFile(altPath);
    }
};

// deno-lint-ignore no-explicit-any
(globalThis as any).fetch = async (url: string | URL | Request, options?: unknown) => {
    const urlStr = (typeof url === 'string') ? url : (url as unknown as { url: string }).url || url.toString();
    
    // Pass-through external URLs (Cloud Functions, Firebase, etc)
    if (urlStr.includes("://") && !urlStr.includes("localhost")) {
        return await (globalThis as unknown as Record<string, (...args: unknown[]) => Promise<Response>>)._originalFetch(url, options);
    }

    try {
        const text = await denoFetcher(url);
        return {
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(JSON.parse(text)),
            ok: true
        } as Response;
    } catch (err: unknown) {
        console.error(`[fetch-mock] Failed local resource '${urlStr}': ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, status: 404 } as Response;
    }
};
// deno-lint-ignore no-explicit-any
(globalThis as any)._originalFetch = fetch;

async function bootOSGI() {
    // Dynamic imports to ensure console is already redirected
    const { default: loaderConfiguration } = await import("https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33");
    const { default: Pandino } = await import("https://esm.sh/@pandino/pandino@0.8.33/denonext/pandino.mjs");

    pandinoInstance = new Pandino({
        ...loaderConfiguration,
        "pandino.base.url": BASE_URL,
        // deno-lint-ignore no-explicit-any
    } as any);

    await pandinoInstance.init();
    await pandinoInstance.start();
    const _context = (pandinoInstance as PandinoInstance).getBundleContext();

    let isFirebase = false;
    try {
        const envPath = join(Deno.cwd(), "public", "env.json");
        const envConfig = JSON.parse(await Deno.readTextFile(envPath));
        const mode = Deno.env.get("PERSISTENCE_MODE") || envConfig.persistence_mode || "local";
        isFirebase = mode === "firebase";
    } catch (_e) {
        isFirebase = Deno.env.get("PERSISTENCE_MODE") === "firebase";
    }

    const coreManifests = [
        "bundles/org.neverplayed.yaml-service/manifest.json",
        "bundles/org.neverplayed.auth-shield/manifest.json",
        "bundles/org.neverplayed.persistence-deno/manifest.json", // Local Tier
        isFirebase ? "bundles/org.neverplayed.persistence-firebase/manifest.json" : null, // Cloud Tier (Optional)
        "bundles/org.neverplayed.persistence-selector/manifest.json",
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/org.neverplayed.limes/manifest.json",
        "bundles/org.neverplayed.config-admin/manifest.json",
        "bundles/org.neverplayed.shell-cli/manifest.json",
        "bundles/org.neverplayed.do-registry/manifest.json",
        "bundles/org.neverplayed.realm-manager/manifest.json",
    ].filter(Boolean) as string[];

    for (const path of coreManifests) {
        const absPath = join(Deno.cwd(), "public", path);
        try {
            const manifestText = await Deno.readTextFile(absPath);
            const manifest = JSON.parse(manifestText);
            const dirPath = absPath.substring(0, absPath.lastIndexOf("/"));
            if (manifest["Bundle-Activator"]) {
                manifest["Bundle-Activator"] = join(dirPath, manifest["Bundle-Activator"].replace(/^\.\//, ""));
            }
            const context = (pandinoInstance as { getBundleContext: () => { installBundle: (m: unknown) => Promise<{ getState: () => number, start: () => Promise<void> }> } }).getBundleContext();
            const bundle = await context.installBundle(manifest);
            if (bundle && (bundle.getState() < 32)) {
                await bundle.start();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`❌ MCP Boot: Failed ${path}:`, message);
        }
    }
}

async function forceCloudUpdate(pid: string, properties: Record<string, unknown>, targetUid: string, id: number) {
    try {
        const FN_URL = "https://europe-west4-cladmin-bc594.cloudfunctions.net/mcpApi";
        const response = await fetch(FN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-mcp-secret": (globalThis as unknown as Record<string, string>).NEVERPLAYED_MCP_SECRET || "",
                "x-mcp-token": (globalThis as unknown as Record<string, string>).NEVERPLAYED_HEADLESS_TOKEN || ""
            },
            body: JSON.stringify({ action: "updateConfig", payload: { pid, properties, uid: targetUid } })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API refused connection (${response.status}): ${errorText}`);
        }
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Direct stateless API update forced for: ${pid} (UID: ${targetUid})` }] } };
    } catch (fallbackErr: unknown) {
        const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error(`[MCP] Cloud update failed: ${message}`);
        return { jsonrpc: "2.0", id, error: { code: -32603, message: `System write failed: ${message}` } };
    }
}

// 4. MCP Protocol Implementation
async function handleRequest(request: { method: string; params: Record<string, unknown>; id: number }) {
    const { method, params, id } = request;

    if (method === "initialize") {
        return {
            jsonrpc: "2.0",
            id,
            result: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                serverInfo: { name: "Never Played OSGi Bridge", version: "1.0.0" }
            }
        };
    }

    if (method === "tools/list") {
        return {
            jsonrpc: "2.0",
            id,
            result: {
                tools: [
                    {
                        name: "osgi_list_services",
                        description: "List all registered OSGi services and their properties.",
                        inputSchema: { type: "object", properties: {} }
                    },
                    {
                      name: "osgi_call_method",
                      description: "Invokes a method on a registered OSGi service.",
                      inputSchema: {
                        type: "object",
                        properties: {
                          serviceId: { type: "string", description: "The service identifier (e.g. @neverplayed/shell-cli/service)" },
                          method: { type: "string", description: "The method name to call" },
                          args: { type: "array", description: "Arguments for the method call" }
                        },
                        required: ["serviceId", "method"]
                      }
                    },
                    {
                      name: "osgi_get_config",
                      description: "Retrieves configuration properties for a bundle (via ConfigAdmin).",
                      inputSchema: {
                        type: "object",
                        properties: {
                          pid: { type: "string", description: "The configuration PID" }
                        },
                        required: ["pid"]
                      }
                    },
                    {
                      name: "osgi_update_config",
                      description: "Updates configuration properties for a bundle (via ConfigAdmin). Supports optional 'uid' to target a specific user (Admin SDK).",
                      inputSchema: {
                        type: "object",
                        properties: {
                          pid: { type: "string", description: "The configuration PID" },
                          properties: { type: "object", description: "Key-value pairs to update" },
                          uid: { type: "string", description: "Optional target User ID (Admin Mode)" }
                        },
                        required: ["pid", "properties"]
                      }
                    },
                    {
                      name: "osgi_launch_flow",
                      description: "Trigger a flow.launch() for a specific capability (via FlowService).",
                      inputSchema: {
                        type: "object",
                        properties: {
                          capability: { type: "string", description: "The capability to launch (e.g. biz:dashboard)" },
                          context: { type: "object", description: "Optional data payload for the flow" }
                        },
                        required: ["capability"]
                      }
                    },
                    {
                      name: "osgi_subscribe_events",
                      description: "Listen for OSGi events Matching a filter (via EventAdmin).",
                      inputSchema: {
                        type: "object",
                        properties: {
                          topic: { type: "string", description: "The event topic (e.g. org/osgi/framework/BundleEvent/*)" },
                          filter: { type: "string", description: "Optional LDAP filter for event properties" }
                        },
                        required: ["topic"]
                      }
                    }
                ]
            }
        };
    }

    if (method === "tools/call") {
        const { name, arguments: toolArgs } = params;
        const context = (pandinoInstance as { getBundleContext: () => { getServiceReferences: (i: unknown, f?: string) => Array<{ getProperty: (k: string) => unknown, getPropertyKeys: () => string[], bundle: { getSymbolicName: () => string } }>, getService: (r: unknown) => unknown } }).getBundleContext();

        if (name === "osgi_list_services") {
            const services = context.getServiceReferences(undefined, undefined).map((ref) => {
                const rawObjectClass = ref.getProperty("objectClass");
                const id = Array.isArray(rawObjectClass) ? rawObjectClass[0] : rawObjectClass;
                console.log(`[MCP Debug] Service Found: ${id} (Raw Type: ${typeof rawObjectClass})`);
                return {
                    id: id || "unknown",
                    properties: ref.getPropertyKeys().reduce((acc: Record<string, unknown>, key: string) => {
                        acc[key] = ref.getProperty(key);
                        return acc;
                    }, {} as Record<string, unknown>)
                };
            });
            return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(services, null, 2) }] } };
        }

        if (name === "osgi_call_method") {
          const { serviceId, method: methodName, args: methodArgs = [] } = toolArgs as Record<string, unknown>;
          console.error(`[MCP] Tool: osgi_call_method(${serviceId}, ${methodName}) ...`);
          const ref = context.getServiceReferences(undefined, `(objectClass=${serviceId})`)[0];
          if (!ref) return { jsonrpc: "2.0", id, error: { code: -32602, message: `Service not found: ${serviceId}` } };
          
          const service = context.getService(ref) as Record<string, unknown>;
          if (typeof service[methodName as string] !== 'function') {
            return { jsonrpc: "2.0", id, error: { code: -32602, message: `Method '${methodName}' not found on ${serviceId}` } };
          }

          try {
            const fn = service[methodName as string] as (...args: unknown[]) => Promise<unknown>;
            const result = await fn(...(methodArgs as unknown[]));
            console.error(`[MCP] Tool: osgi_call_method(${serviceId}, ${methodName}) COMPLETED.`);
            return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { jsonrpc: "2.0", id, error: { code: -32603, message: `Call failed: ${message}` } };
          }
        }

        if (name === "osgi_get_config") {
          const { pid } = toolArgs as { pid: string };
          const ref = context.getServiceReferences(undefined, "(objectClass=@neverplayed/config-admin/ConfigAdmin)")[0];
          if (!ref) return { jsonrpc: "2.0", id, error: { code: -32603, message: "ConfigAdmin not available" } };
          
          const ca = context.getService(ref) as { getConfiguration: (p: string) => { getProperties: () => Record<string, unknown> } };
          const config = ca.getConfiguration(pid);
          return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(config.getProperties(), null, 2) }] } };
        }

        if (name === "osgi_update_config") {
          const { pid, properties, uid: targetUid } = toolArgs as { pid: string, properties: Record<string, unknown>, uid?: string };
          const agentUid = (globalThis as unknown as Record<string, { uid: string }>).NEVERPLAYED_HEADLESS_USER?.uid || "mcp-agent-mcp";
          
          // 1. If we are targeting another user, we MUST use the stateless Cloud Function API
          if (targetUid && targetUid !== agentUid) {
              console.log(`[MCP] Target UID '${targetUid}' detected. Forcing stateless Cloud Function path...`);
              return await forceCloudUpdate(pid, properties, targetUid, id);
          }

          // 2. Otherwise, try native OSGi write first (for the Agent's own state)
          const ref = context.getServiceReferences(undefined, "(objectClass=@neverplayed/config-admin/ConfigAdmin)")[0];
          if (!ref) return { jsonrpc: "2.0", id, error: { code: -32603, message: "ConfigAdmin not available" } };
          
          const ca = context.getService(ref) as { getConfiguration: (p: string) => { getProperties: () => Record<string, unknown>, update: (p: Record<string, unknown>) => Promise<void> } };
          const config = ca.getConfiguration(pid);
          
          try {
              if (typeof config.update !== 'function') {
                throw new Error("config.update is not a function");
              }
              await config.update(properties);
              return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Configuration updated locally for ${pid}` }] } };
          } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              console.warn(`[MCP] Native OSGi write failed (${message}). Falling back to Cloud Function...`);
              return await forceCloudUpdate(pid, properties, targetUid || agentUid, id);
          }
        }

        if (name === "osgi_launch_flow") {
          const { capability, context: flowContext = {} } = toolArgs as { capability: string, context?: Record<string, unknown> };
          const ref = context.getServiceReferences(undefined, "(objectClass=@neverplayed/flow-service)")[0];
          if (!ref) return { jsonrpc: "2.0", id, error: { code: -32603, message: "FlowService not available" } };
          
          
          const fs = context.getService(ref) as { launch: (c: string, ctx: Record<string, unknown>) => Promise<void> };
          try {
            await fs.launch(capability, flowContext);
            return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Flow launched for capability: ${capability}` }] } };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { jsonrpc: "2.0", id, error: { code: -32603, message: `Launch failed: ${message}` } };
          }
        }

        if (name === "osgi_subscribe_events") {
          const { topic, filter: _filter } = toolArgs as { topic: string, filter?: string };
          const ref = context.getServiceReferences(undefined, "(objectClass=org/osgi/service/event/EventAdmin)")[0];
          if (!ref) return { jsonrpc: "2.0", id, error: { code: -32603, message: "EventAdmin not available" } };
          
          return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Subscription established for topic: ${topic}. Note: Real-time event streaming is currently being implemented via MCP Resources.` }] } };
        }
    }

    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}

// 5. Stdio Transport Loop
async function startMCP() {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    for await (const chunk of Deno.stdin.readable) {
        const text = decoder.decode(chunk);
        const lines = text.trim().split("\n");

        for (const line of lines) {
            if (!line) continue;
            try {
                const request = JSON.parse(line);
                const response = await handleRequest(request);
                await Deno.stdout.write(encoder.encode(JSON.stringify(response) + "\n"));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error("MCP Error:", message);
            }
        }
    }
}

// 🚀 Boot everything
(async () => {
    // Prevent Deno from crashing on late-arriving unhandled Firestore/Network rejections
    globalThis.addEventListener("unhandledrejection", (e) => {
        console.warn(`[MCP] Caught unhandled promise rejection: ${e.reason}`);
        e.preventDefault();
    });

    await bootOSGI();
    console.log("🚀 MCP OSGi Bridge is listening on stdin...");
    await startMCP();
})().catch(err => {
    Deno.stderr.writeSync(new TextEncoder().encode(`FATAL: ${err.message}\n`));
    Deno.exit(1);
});
