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
export class PandinoHarness {
    private pandino: any;
    private context: any;
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
        for (const bPath of bundlePaths) {
            try {
                await this.context.installBundle(bPath);
            } catch (e) {
                console.error(`Harness: Failed to install bundle at ${bPath}`, e);
                throw e;
            }
        }
        
        console.log(`Harness: Booted ${realmPaths.length} realms. Total bundles: ${this.context.getBundles().length} 🛰️✅`);
    }

    /**
     * Helper to wait for microtasks and reactivity
     */
    async settle(ms = 100) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Direct OSGi Service discovery
     */
    getService(interfaceId: string, filter?: string) {
        if (filter) {
            const refs = this.context.getServiceReferences(interfaceId, filter);
            return refs && refs.length > 0 ? this.context.getService(refs[0]) : null;
        }
        const ref = this.context.getServiceReference(interfaceId);
        return ref ? this.context.getService(ref) : null;
    }

    /**
     * Reactive Service Poll (Wait for a service to appear)
     */
    async waitForService(interfaceId: string, timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const svc = this.getService(interfaceId);
            if (svc) return svc;
            await this.settle(50);
        }
        throw new Error(`Harness: Timeout waiting for service ${interfaceId}`);
    }

    /**
     * Register a mock persistence provider into the active context.
     */
    async registerMockPersistence(tier: string, implementation = "mock-provider") {
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
            await this.pandino.stop();
        }
        console.log("Harness: Core De-Activated 🛰️👋");
    }

    getContext() {
        return this.context;
    }
}
