/**
 * Filesystem-based Headless Boot Script for Never Played 🌌🔥
 * Supports Hot-Swapping of activators.
 * Run via: deno task headless-fs
 */

import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-dom@0.8.33";
import Pandino from "https://esm.sh/@pandino/pandino@0.8.33";
import { join } from "https://deno.land/std@0.221.0/path/mod.ts";

console.log("🌌 Never Played: Starting Headless FS Universe...");

const BUNDLES_ROOT = "./public/bundles";

// 1. Mock the DOM essentials
// @ts-ignore: Mocking DOM
globalThis.document = {
  createElement: () => ({ appendChild: () => {}, setAttribute: () => {}, style: {} }),
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  getElementsByTagName: () => [],
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};
// @ts-ignore: Mocking window
globalThis.window = globalThis;
// @ts-ignore: Mocking CustomEvent
globalThis.CustomEvent = class { constructor(_name: string, detail: unknown) { (this as unknown as Record<string, unknown>).detail = detail; } };
// @ts-ignore: Mocking Alpine
globalThis.Alpine = {
  data: () => {},
  store: () => {},
  effect: () => {},
  reactive: <T>(obj: T): T => obj,
};

// 2. Persistence Mock
class DenoPersistenceManager {
  load(key: string) {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  }
  store(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// 3. Hot-Swap Registry
// deno-lint-ignore no-explicit-any
const activeActivators = new Map<string, any>();
const pandino = new Pandino({ ...loaderConfiguration });

async function loadBundle(bundleDir: string) {
    const bsn = bundleDir.replace(/^org\.neverplayed\./, "@neverplayed/");
    const activatorPath = join(Deno.cwd(), BUNDLES_ROOT, bundleDir, "activator.js");
    
    console.log(`📦 Loading activator: ${bsn}...`);
    
    try {
        // Use cache-busting to force reload
        const module = await import(`file://${activatorPath}?update=${Date.now()}`);
        const ActivatorClass = module.default;
        
        if (ActivatorClass) {
            const context = pandino.getBundleContext();
            const activator = new ActivatorClass();
            await activator.start(context);
            activeActivators.set(bundleDir, activator);
            console.log(`✅ ${bsn} is now ACTIVE.`);
        }
    } catch (err) {
        console.error(`❌ Failed to load ${bsn}:`, err);
    }
}

async function unloadBundle(bundleDir: string) {
    const activator = activeActivators.get(bundleDir);
    if (activator) {
        const bsn = bundleDir.replace(/^org\.neverplayed\./, "@neverplayed/");
        const context = pandino.getBundleContext();
        try {
            await activator.stop(context);
        } catch (err) {
            console.warn(`⚠️ Error during stop for ${bsn}:`, err);
        }
        activeActivators.delete(bundleDir);
        console.log(`🛑 ${bsn} has been STOPPED.`);
    }
}

async function boot() {
    await pandino.init();
    await pandino.start();
    const context = pandino.getBundleContext();
    
    // Register Persistence
    context.registerService("@pandino/persistence-manager/PersistenceManager", new DenoPersistenceManager());

    // 4. Initial Load
    for await (const dirEntry of Deno.readDir(BUNDLES_ROOT)) {
        if (dirEntry.isDirectory && dirEntry.name.startsWith("org.neverplayed.")) {
            await loadBundle(dirEntry.name);
        }
    }

    console.log("\n🌌 Headless FS Universe is Active!");
    console.log("👀 Watching /bundles for changes...");

    const watcher = Deno.watchFs(BUNDLES_ROOT);
    for await (const event of watcher) {
        if (event.kind === "modify") {
            for (const path of event.paths) {
                // Extract bundle directory from path
                const relativePath = path.replace(join(Deno.cwd(), BUNDLES_ROOT), "");
                const bundleDir = relativePath.split(/[\\/]/)[1];
                
                if (bundleDir && bundleDir.startsWith("org.neverplayed.")) {
                    if (path.endsWith("activator.js")) {
                        console.log(`\n🔄 Change detected in ${bundleDir}, reloading...`);
                        await unloadBundle(bundleDir);
                        await loadBundle(bundleDir);
                    }
                }
            }
        }
    }
}

boot().catch(console.error);