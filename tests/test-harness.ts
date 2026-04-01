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
            (globalThis as any).location = { href: 'http://localhost/', hostname: 'localhost' };
        }

        // deno-lint-ignore no-explicit-any
        if (!(globalThis as any).sessionStorage) {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).sessionStorage = { getItem: () => null, setItem: (_k: string, _v: string) => {} };
        }

        const denoFetcher = async (url: string | URL) => {    
            const urlStr = url instanceof URL ? url.toString() : url;
            const path = urlStr.replace(/^file:\/+/ , "/").split('?')[0];
            try {
                return await Deno.readTextFile(path);
            } catch (_err) {
                const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
                return await Deno.readTextFile(altPath);
            }
        };

        // deno-lint-ignore no-explicit-any
        (globalThis as any).fetch = async (url: string | URL) => {
            const text = await denoFetcher(url);
            return {
                text: () => Promise.resolve(text),
                json: () => Promise.resolve(JSON.parse(text)),
                ok: true
            };
        };

        // deno-lint-ignore no-explicit-any
        (globalThis as any).denoFetcher = denoFetcher;
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
        if (this.pandino) await this.pandino.stop();
    }
}
