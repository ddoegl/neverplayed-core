/**
 * Headless Boot Script for Never Played 🌌😶‍🌫️
 * Run via: deno run -A --location http://localhost scripts/headless-boot.ts
 */

import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-dom@0.8.33";
import Pandino from "https://esm.sh/@pandino/pandino@0.8.33";
import { serveDir } from "https://deno.land/std@0.221.0/http/file_server.ts";

console.log("🌌 Never Played: Starting Headless Universe...");

// 0. Start a minimal static server for bundles
const server = Deno.serve({ port: 0 }, (req) => {
  return serveDir(req, {
    fsRoot: "public",
    urlRoot: "",
    showDirListing: true,
    enableCors: true,
  });
});

const PORT = (server.addr as Deno.NetAddr).port;
console.log(`🌐 Bundle Server running at http://localhost:${PORT}`);


// 1. Mock the DOM essentials for Pandino/Loader
// @ts-ignore: Mocking DOM for headless environment
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
// @ts-ignore: Mocking window for Alpine/Pandino
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

// 2. Headless Persistence Manager (In-Memory/LocalStorage)
class DenoPersistenceManager {
  load(key: string) {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  }
  store(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function boot() {
  const pandino = new Pandino({ 
    ...loaderConfiguration,
  });

  await pandino.init();
  await pandino.start();

  const context = pandino.getBundleContext();

  // 3. Register Headless Infrastructure
  context.registerService("@pandino/persistence-manager/PersistenceManager", new DenoPersistenceManager());
  console.log("✅ Headless Persistence Manager registered.");

  // 4. Load Core Services (Server-Side compatible)
  const coreBundles = [
    "bundles/org.neverplayed.system-logger/manifest.json",
    "bundles/org.neverplayed.config-admin/manifest.json",
    "bundles/org.neverplayed.system-reset/manifest.json",
    "bundles/org.neverplayed.shell-cli/manifest.json",
  ];

  for (const bundlePath of coreBundles) {
    const url = `http://localhost:${PORT}/${bundlePath}`;
    console.log(`📦 Installing: ${url}...`);
    try {
      const b = await context.installBundle(url);
      if (b && Number(b.getState()) < 32) { // 32 is ACTIVE
        await b.start();
        console.log(`🚀 Started: ${b.getSymbolicName()}`);
      } else if (b) {
        console.log(`ℹ️ Already Active: ${b.getSymbolicName()}`);
      }
    } catch (err) {
      console.error(`❌ Failed to load ${bundlePath}:`, err);
    }
  }

    console.log("🌌 Headless Universe is Active!");
    
    // 5. Audit Registry
    console.log("🔍 Audit: Registered Services");
    // Wait a bit for trackers to settle
    await new Promise(r => setTimeout(r, 100));

    // Targeted Check
    const caRef = context.getServiceReference("@neverplayed/config-admin/ConfigAdmin");
    if (caRef) {
        console.log("✅ ConfigAdmin found via direct lookup!");
    } else {
        console.log("❌ ConfigAdmin NOT FOUND via direct lookup!");
    }

    console.log("✅ Headless Audit Complete.");
    Deno.exit(0);
}

boot().catch(console.error);
