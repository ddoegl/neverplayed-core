import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import Pandino from "npm:@pandino/pandino";
import loaderConfiguration from "./deno-loader-configuration.ts";

import { Window } from "npm:happy-dom";

const window = new Window();
const document = window.document;

// Helper to wait for reactivity and microtasks
const _settle = () => new Promise(resolve => setTimeout(resolve, 100));

// 2. Map Globals (Must happen BEFORE importing Alpine)
// deno-lint-ignore no-explicit-any
const g = globalThis as any;
Object.assign(g, {
  window,
  document,
  Node: window.Node,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  HTMLSpanElement: window.HTMLSpanElement,
  HTMLButtonElement: window.HTMLButtonElement,
  MutationObserver: window.MutationObserver,
  CustomEvent: window.CustomEvent,
  ShadowRoot: window.ShadowRoot,
  DocumentFragment: window.DocumentFragment,
  NodeList: window.NodeList,
  HTMLCollection: window.HTMLCollection,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  navigator: window.navigator,
  location: window.location,
  self: window,
});

// 3. Import Alpine from NPM
// We use a robust resolver to find the Alpine instance in the module
const AlpineModule = await import("npm:alpinejs");
const Alpine = AlpineModule.Alpine || AlpineModule.default?.Alpine || AlpineModule.default || AlpineModule;

// 4. Initialize Alpine ONCE
Alpine.start();

const MY_DEPLOY_ROOT = Deno.cwd() + "/public/bundles";
console.log(MY_DEPLOY_ROOT);

Deno.test({
  name: "Pandino Bundle Lifecycle Test",
  sanitizeResources: false, // Required if bundles leave handles open (like servers)
  sanitizeOps: false,
  async fn() {
    // 1. Setup Pandino with our Deno loader
    const pandino = new Pandino({
      ...loaderConfiguration,
      "pandino.deployment.root": MY_DEPLOY_ROOT,
    });

    // 2. Initialize and Start
    await pandino.init();
    await pandino.start();

    

    // 3. Get the Bundle Context to inspect loaded bundles
    const context = pandino.getBundleContext();
    await context.installBundle("./org.neverplayed.shell-host/manifest.json");
    const bundles = context.getBundles();

    console.log(`\nTotal bundles loaded: ${bundles.length}`);

    // 4. Verification Logic
    for (const bundle of bundles) {
      console.log(`Checking Bundle: ${bundle.getSymbolicName()} [${bundle.getVersion()}]`);
      
      // State 32 is 'ACTIVE' in OSGi/Pandino terms
      // You can also use Bundle.ACTIVE if you import the constants
      assertEquals(bundle.getState(), 'ACTIVE', `Bundle ${bundle.getSymbolicName()} should be ACTIVE`);
    }

    // 5. Cleanup (Optional: Stop Pandino after tests)
    await pandino.stop();
  },
});