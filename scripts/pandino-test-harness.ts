import Pandino from "npm:@pandino/pandino";
import loaderConfiguration from "./deno-loader-configuration.ts";

import { createMockPersistenceProvider } from "./test-harness-globals.ts";

/**
 * Pandino Test Harness
 * 
 * Provides an encapsulated orchestrator for running OSGi/Pandino bundles 
 * in a TDD environment. Handles realm loading, sequential installation, 
 * and reactive service discovery.
 */
interface PandinoInstance {
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getBundleContext(): BundleContext;
}

interface BundleContext {
    getServiceReferences(id: string, filter?: string): unknown[];
    getServiceReference(id: string): unknown;
    getService(ref: unknown): unknown;
    getBundles(): unknown[];
    installBundle(manifestOrUrl: unknown): Promise<unknown>;
    registerService(id: string | string[], service: unknown, properties?: Record<string, unknown>): unknown;
}

export class PandinoHarness {
    private pandino: PandinoInstance | null = null;
    private context: BundleContext | null = null;
    private deployRoot: string;

    constructor(deployRoot?: string) {
        this.deployRoot = deployRoot || (Deno.cwd() + "/public/bundles");
    }

    /**
     * Initialize and Start Pandino
     */
    async init() {
        this.pandino = new Pandino({
            ...loaderConfiguration,
            "pandino.deployment.root": this.deployRoot,
        });

        await this.pandino.init();
        await this.pandino.start();
        this.context = this.pandino.getBundleContext();
        
        // Ensure Alpine is initialized globally if available
        // deno-lint-ignore no-explicit-any
        const g = globalThis as any;
        if (g.Alpine && typeof g.Alpine.start === 'function') {
            g.Alpine.start();
        }
        
        return this.context;
    }

    /**
     * Boot realms from JSON specifications (e.g., core.json)
     */
    async bootRealms(realmPaths: string[]) {
        const bundlePaths: string[] = [];
        
        for (const path of realmPaths) {
            const text = await Deno.readTextFile(path);
            const spec = JSON.parse(text);
            if (spec.bundles) {
                spec.bundles.forEach((bPath: string) => {
                    // Normalize realm paths (./bundles/...) to harness paths (./...)
                    bundlePaths.push(bPath.replace(/^\.\/bundles\//, "./"));
                });
            }
        }

        // Installation Cycle
        const context = this.context;
        if (!context) throw new Error("Harness: Context not initialized.");

        for (const bPath of bundlePaths) {
            try {
                await context.installBundle(bPath);
            } catch (e) {
                console.error(`Harness: Failed to install bundle at ${bPath}`, e);
                throw e;
            }
        }
        
        console.log(`Harness: Booted ${realmPaths.length} realms. Total bundles: ${context.getBundles().length} 🛰️✅`);
    }

    /**
     * Helper to wait for microtasks and reactivity
     */
    settle(ms = 100): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Direct OSGi Service discovery
     */
    getService<T = unknown>(interfaceId: string, filter?: string): T | null {
        const context = this.context;
        if (!context) return null;
        
        if (filter) {
            const refs = context.getServiceReferences(interfaceId, filter);
            return refs && refs.length > 0 ? context.getService(refs[0]) as T : null;
        }
        // @ts-ignore: Internal JS bridge
        const ref = context.getServiceReference(interfaceId);
        return ref ? context.getService(ref) as T : null;
    }

    /**
     * Reactive Service Poll (Wait for a service to appear)
     */
    async waitForService<T = unknown>(interfaceId: string, filterOrTimeout: string | number = 2000, timeout = 2000): Promise<T> {
        const start = Date.now();
        const filter = typeof filterOrTimeout === 'string' ? filterOrTimeout : undefined;
        const actualTimeout = typeof filterOrTimeout === 'number' ? filterOrTimeout : timeout;

        while (Date.now() - start < actualTimeout) {
            const svc = this.getService<T>(interfaceId, filter);
            if (svc) return svc;
            await this.settle(50);
        }
        throw new Error(`Harness: Timeout waiting for service ${interfaceId} ${filter ? `with filter ${filter}` : ''}`);
    }

    /**
     * Register a mock persistence provider into the active context.
     */
    registerMockPersistence(tier: string, implementation = "mock-provider") {
        if (!this.context) throw new Error("Harness: Context not initialized. Call init() first.");
        
        const mock = createMockPersistenceProvider(tier, implementation);
        const INTERFACE = "@pandino/persistence-manager/PersistenceManager";
        
        this.context.registerService(INTERFACE, mock, {
            "persistence.tier": tier,
            "implementation": implementation,
            "type": "provider"
        });
        
        return mock;
    }

    /**
     * Shutdown
     */
    async stop() {
        if (this.pandino) {
            await (this.pandino as PandinoInstance).stop();
        }
        console.log("Harness: Core De-Activated 🛰️👋");
    }

    getContext() {
        return this.context;
    }
}
