import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33";
import Pandino from "@pandino/pandino/denonext/pandino.mjs";
import { resolve, join } from "https://deno.land/std@0.221.0/path/mod.ts";

/**
 * Pandino Kernel Interface (Minimal) 🏛️🛰️
 */
interface PandinoKernel {
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getBundleContext(): BundleContext;
}

/**
 * Bundle Context Interface (Minimal) 🏛️🛰️
 */
interface BundleContext {
    // deno-lint-ignore no-explicit-any
    getServiceReference(id: string): any;
    // deno-lint-ignore no-explicit-any
    getService(ref: any): any;
    // deno-lint-ignore no-explicit-any
    getBundles(): any[];
    // deno-lint-ignore no-explicit-any
    installBundle(manifestOrUrl: any): Promise<Bundle>;
    // deno-lint-ignore no-explicit-any
    registerService(id: string | string[], service: any, properties?: any): any;
}

interface Bundle {
    getState(): number;
    start(): Promise<void>;
    stop(): Promise<void>;
}

/**
 * Unified Deno-Native Harness (v1.6)
 * Exact logic mirror of the verified functional baseline with tightened types.
 */
export class BundleTestHarness {
    // deno-lint-ignore no-explicit-any
    private pandino: any = null;
    // deno-lint-ignore no-explicit-any
    private context: any = null;
    // deno-lint-ignore no-explicit-any
    private window: any = null;
    private baseUrl: string;

    constructor() {
        this.baseUrl = `file://${Deno.cwd()}/public/`;
    }

    private async _setupGlobalsOnce() {
        if (this.window) return;

        const { Window } = await import("https://esm.sh/happy-dom@13.3.8");
        this.window = new Window();

        // 🚀 BROWSER PROMOTION: Export Happy DOM constructors and instances to Deno's globalThis
        // This is critical for ESM bundles (like Alpine.js or our UI components) 
        // that expect standard browser APIs to be available globally (e.g. HTMLElement, customElements).
        // deno-lint-ignore no-explicit-any
        const window = this.window as any;
        
        // 1. Mandatory constructors
        const constructors = [
            'Node', 'Element', 'HTMLElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLButtonElement',
            'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLStyleElement',
            'CustomEvent', 'Event', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
            'CharacterData', 'DocumentFragment', 'NamedNodeMap', 'Text', 'Comment', 'Attr',
            'CustomElementRegistry'
        ];

        // 2. Mandatory instances (lowercase)
        const instances = [
            'window', 'document', 'navigator', 'location', 'history',
            'customElements', 'localStorage', 'sessionStorage'
        ];

        [...constructors, ...instances].forEach(key => {
            // deno-lint-ignore no-explicit-any
            if (window[key] && !(globalThis as any)[key]) {
                try {
                    // deno-lint-ignore no-explicit-any
                    (globalThis as any)[key] = window[key];
                } catch (_e) { /* ignore read-only */ }
            }
        });

        // 3. Fallback: Catch any other Passthrough constructors not in our list
        Object.getOwnPropertyNames(window).forEach(key => {
            // deno-lint-ignore no-explicit-any
            if (key[0] === key[0].toUpperCase() && typeof window[key] === 'function' && !(globalThis as any)[key]) {
                try {
                    // deno-lint-ignore no-explicit-any
                    (globalThis as any)[key] = window[key];
                } catch (_err) {
                    /* empty */
                }
            }
        });

        // Essential Browser API Mocks - Force linkage to our window instance
        // deno-lint-ignore no-explicit-any
        (globalThis as any).window = globalThis;
        // deno-lint-ignore no-explicit-any
        (globalThis as any).document = window.document;
        // deno-lint-ignore no-explicit-any
        (globalThis as any).navigator = window.navigator;
        // deno-lint-ignore no-explicit-any
        (globalThis as any).NEVERPLAYED_BASE_URL = this.baseUrl;
        
        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).location) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).location = { href: 'http://localhost/', hostname: 'localhost' };
        }
    }

    async init() {
        await this._setupGlobalsOnce();

        if (this.pandino) return this.context;

        // The "Golden" Deno Fetcher Logic - Upgraded for remote support
        const denoFetcher = async (url: string | URL) => {
            let urlStr = url instanceof URL ? url.toString() : url;
            
            // Remote URLs: Use native fetch directly
            if (urlStr.startsWith("https://") || (urlStr.startsWith("http://") && !urlStr.includes("localhost"))) {
                try {
                    const response = await fetch(urlStr);
                    if (!response.ok) return null;
                    return await response.text();
                } catch (_err) {
                    return null;
                }
            }

            if (urlStr.startsWith("http://localhost/")) {
                urlStr = urlStr.replace("http://localhost/", "/");
            }
            const path = urlStr.replace(/^file:\/+/ , "/").split('?')[0];
            try {
                return await Deno.readTextFile(path);
            } catch (_err) {
                const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
                try {
                    return await Deno.readTextFile(altPath);
                } catch (__err) {
                    return null;
                }
            }
        };

        // Standard Global Fetch Interceptor
        const originalFetch = globalThis.fetch;
        // deno-lint-ignore no-explicit-any
        (globalThis as any).fetch = async (url: string | URL, init?: any) => {
            const urlStr = url instanceof URL ? url.toString() : url;
            if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
                if (!urlStr.includes("localhost")) return await originalFetch(url, init);
            }
            const text = await denoFetcher(url);
            if (text === null) {
                return {
                    status: 404, ok: false,
                    text: () => Promise.resolve("Not Found"),
                    json: () => Promise.reject(new Error("Not Found"))
                    // deno-lint-ignore no-explicit-any
                } as any;
            }
            return {
                text: () => Promise.resolve(text || ""),
                json: () => Promise.resolve(JSON.parse(text || "{}")),
                ok: true
                // deno-lint-ignore no-explicit-any
            } as any;
        };

        // Initialize Pandino with the exact baseline configuration plus fetcher override
        const finalConfig = {
            ...loaderConfiguration,
            "pandino.loader.fetcher": denoFetcher,
            "pandino.base.url": this.baseUrl,
        };

        // deno-lint-ignore no-explicit-any
        this.pandino = new Pandino(finalConfig as any);

        await this.pandino.init();
        await this.pandino.start();
        this.context = this.pandino.getBundleContext();

        return this.context;
    }

    async installBundles(paths: string[]) {
        const context = this.context;
        if (!context) throw new Error("Harness: Context missing.");

        for (const path of paths) {
            // Bypass local resolution for remote URLs
            if (path.startsWith("http://") || path.startsWith("https://")) {
                const bundle = await context.installBundle(path);
                if (Number(bundle.getState()) === 2) { 
                    await bundle.start();
                }
                continue;
            }

            const url = `${this.baseUrl}${path}`;
            const absPath = url.replace(/^file:\/+/ , "/");
            const manifestText = await Deno.readTextFile(absPath);
            const manifest = JSON.parse(manifestText);
            const dirPath = absPath.substring(0, absPath.lastIndexOf("/"));
            
            if (manifest["Bundle-Activator"]) {
                manifest["Bundle-Activator"] = join(dirPath, manifest["Bundle-Activator"].replace(/^\.\//, ""));
            }
            
            const bundle = await context.installBundle(manifest);
            if (Number(bundle.getState()) === 2) { 
                await bundle.start();
            }
        }
    }

    getService<T>(id: string, timeout = 5000): Promise<T> {
        const context = this.context;
        if (!context) throw new Error("Harness: Context missing.");
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                const ref = context.getServiceReference(id);
                if (ref) {
                    resolve(context.getService(ref));
                } else if (Date.now() - start > timeout) {
                    reject(new Error(`Service timeout: ${id}`));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async stop() {
        if (!this.pandino) return;
        const context = this.context;
        if (context) {
            const bundles = context.getBundles();
            for (const b of bundles) {
                if (b.getState() === 32) { // ACTIVE
                    try { await b.stop(); } catch (_e: unknown) { /* ignore */ }
                }
            }
        }
        await this.pandino.stop();
        this.pandino = null;
    }

    getDocument() { return this.window?.document; }
    // deno-lint-ignore no-explicit-any
    getWindow() { return (globalThis as any).window; }
    getBundleContext() { return this.context; }
    getContext() { return this.context; }
}
