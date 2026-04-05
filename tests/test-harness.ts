import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33";
import Pandino from "https://esm.sh/@pandino/pandino@0.8.33/denonext/pandino.mjs";
import { resolve, join } from "https://deno.land/std@0.221.0/path/mod.ts";

export class BundleTestHarness {
    // deno-lint-ignore no-explicit-any
    private pandino: any;
    // deno-lint-ignore no-explicit-any
    private context: any;
    private baseUrl: string;

    constructor() {
        this.baseUrl = `file://${Deno.cwd()}/public/`;
        this.setupMocks();
    }

    private setupMocks() {
        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).Node) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).Node = class Node {
                nodeType = 1;
                appendChild() {}
                addEventListener() {}
            };
        }
        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).Element) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).Element = class Element extends (globalThis as any).Node {
                setAttribute() {}
                getAttribute() { return null; }
                querySelector() { return null; }
                querySelectorAll() { return []; }
            };
        }
        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).HTMLElement) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).HTMLElement = class HTMLElement extends (globalThis as any).Element {
                style = {};
            };
        }

        // Only mock document if not present
        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).document) {
            const mockElement = () => ({ 
                style: {}, 
                appendChild: () => {}, 
                addEventListener: () => {}, 
                setAttribute: () => {}, 
                querySelector: () => null, 
                querySelectorAll: () => [],
                parentNode: { appendChild: () => {} },
                getAttribute: () => null,
                remove: () => {}
            });

            const mockDoc = {
                createElement: mockElement,
                createTextNode: () => ({}),
                head: { appendChild: () => {} },
                body: { appendChild: () => {}, style: {} },
                querySelector: () => null,
                querySelectorAll: () => [],
                addEventListener: () => {},
                getElementsByTagName: () => [mockElement()],
                documentElement: { style: {} }
            };
            // deno-lint-ignore no-explicit-any
            (globalThis as any).document = mockDoc;
        }

        // deno-lint-ignore no-explicit-any
        (globalThis as any).window = globalThis;
        // deno-lint-ignore no-explicit-any
        (globalThis as any).NEVERPLAYED_BASE_URL = this.baseUrl;
        
        // Note: Deno location is read-only if set via flag, 
        // so we only mock if missing or if we really need to override (risky)
        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).location) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).location = { 
                href: 'http://localhost/', 
                origin: 'http://localhost', 
                hostname: 'localhost' 
            };
        }

        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).MutationObserver) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).MutationObserver = class {
                constructor(_callback: any) {}
                disconnect() {}
                observe(_element: any, _options: any) {}
                takeRecords() { return []; }
            };
        }

        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).sessionStorage) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).sessionStorage = { getItem: () => null, setItem: (_k: string, _v: string) => {} };
        }

        const denoFetcher = async (url: string | URL) => {    
            let urlStr = url instanceof URL ? url.toString() : url;
            if (urlStr.startsWith("http://localhost/")) {
                urlStr = urlStr.replace("http://localhost/", "/");
            }
            if (urlStr.startsWith("https://") || (urlStr.startsWith("http://") && !urlStr.includes("localhost"))) {
                return null;
            }
            const path = urlStr.replace(/^file:\/+/ , "/").split('?')[0];
            try {
                return await Deno.readTextFile(path);
            } catch (_err) {
                const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
                try {
                    return await Deno.readTextFile(altPath);
                } catch (__err) {
                    return null; // Silent failure for missing bundles in tests
                }
            }
        };

        const originalFetch = (globalThis as any).fetch || fetch;
        // deno-lint-ignore no-explicit-any
        (globalThis as any).fetch = async (url: string | URL, init?: any) => {
            const urlStr = url instanceof URL ? url.toString() : url;
            if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
                if (!urlStr.includes("localhost")) return await originalFetch(url, init);
            }
            const text = await denoFetcher(url);
            if (text === null) {
                return {
                    status: 404,
                    ok: false,
                    text: () => Promise.resolve("Not Found (Harness)"),
                    json: () => Promise.reject(new Error("Not Found"))
                };
            }
            return {
                text: () => Promise.resolve(text || ""),
                json: () => Promise.resolve(JSON.parse(text || "{}")),
                ok: true
            };
        };

        // deno-lint-ignore no-explicit-any
        (globalThis as any).denoFetcher = denoFetcher;
    }

    getBundleContext() {
        return this.context;
    }

    async init() {
        this.pandino = new Pandino({
            ...loaderConfiguration,
            // deno-lint-ignore no-explicit-any
            "pandino.loader.fetcher": (globalThis as any).denoFetcher,
            "pandino.base.url": this.baseUrl,
            // deno-lint-ignore no-explicit-any
        } as any);

        await this.pandino.init();
        await this.pandino.start();
        this.context = this.pandino.getBundleContext();
        return this.context;
    }

    async installBundles(paths: string[]) {
        for (const path of paths) {
            const url = `${this.baseUrl}${path}`;
            const absPath = url.replace(/^file:\/+/ , "/");
            const manifestText = await Deno.readTextFile(absPath);
            const manifest = JSON.parse(manifestText);
            const dirPath = absPath.substring(0, absPath.lastIndexOf("/"));
            
            if (manifest["Bundle-Activator"]) {
                manifest["Bundle-Activator"] = join(dirPath, manifest["Bundle-Activator"].replace(/^\.\//, ""));
            }
            // deno-lint-ignore no-explicit-any
            const bundle = await this.context.installBundle(manifest) as any;
            if (Number(bundle.getState()) === 2) {
                await bundle.start();
            }
        }
    }

    // deno-lint-ignore no-explicit-any
    getService<T = any>(id: string, timeout = 5000): Promise<T> {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                const ref = this.context.getServiceReference(id);
                if (ref) {
                    resolve(this.context.getService(ref));
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
        
        // 1. Manually stop all bundles to ensure onStop hooks finish
        const context = (this.pandino as any).getBundleContext();
        if (context) {
            const bundles = context.getBundles();
            for (const b of bundles) {
                if (b.getState() === 32) { // ACTIVE
                    try { await b.stop(); } catch (_e) { /* ignore */ }
                }
            }
        }
        
        // 2. Shut down kernel
        await this.pandino.stop();
        
        // 3. Drain event loop to ensure clearTimeout propagates
        await new Promise(r => setTimeout(r, 50));
    }
}
