import { Window } from "npm:happy-dom";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * THE DEFINITIVE FIX: Alpine.js + Happy DOM in Deno
 * 
 * Lessons learned:
 * 1. Prototype Mapping: HTMLElement and sub-classes MUST be on globalThis BEFORE Alpine is imported.
 * 2. Module Instance: npm:alpinejs is more consistent than esm.sh for Deno's NPM bridge.
 * 3. Lifecycle: Alpine.start() should be called ONCE. initTree() should be used for subsequent tests.
 * 4. Events: Dispatching DOMContentLoaded manually helps Happy DOM trigger Alpine's internal ready state.
 */

// 1. Setup Environment
const window = new Window();
const document = window.document;

// Helper to wait for reactivity and microtasks
const settle = () => new Promise(resolve => setTimeout(resolve, 100));

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

Deno.test("Alpine.js Counter Test - Stable", async () => {
  // Clear and set HTML
  document.body.innerHTML = `
    <div x-data="{ count: 0 }" id="app">
      <button @click="count++" id="btn">Increment</button>
      <span x-text="count.toString()" id="output"></span>
    </div>
  `;

  // Force Alpine to process the new tree
  // We use the app root for tighter scoping
  const app = document.getElementById("app")!;
  await Alpine.initTree(app);
  
  // Happy DOM magic bullet: trigger the event Alpine is listening for
  document.dispatchEvent(new window.Event("DOMContentLoaded"));

  // Wait for initial hydration
  await settle();

  const output = document.getElementById("output")!;
  const button = document.getElementById("btn")!;

  // Verify initial state
  // trim() is used to handle potential whitespace differences
  assertEquals(output.textContent?.trim(), "0");

  // Interaction (ensure bubbles: true for Alpine's delegation)
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  
  // Wait for reactivity to settle
  await settle();

  assertEquals(output.textContent?.trim(), "1");
});

Deno.test("Alpine.js Toggle Test - Stable", async () => {
  document.body.innerHTML = `
    <div x-data="{ open: false }" id="toggle-app">
      <button @click="open = !open" id="toggle">Toggle</button>
      <span x-show="open" id="content" style="display: none;">Hello</span>
    </div>
  `;

  const app = document.getElementById("toggle-app")!;
  await Alpine.initTree(app);
  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await settle();

  const button = document.getElementById("toggle")!;
  // deno-lint-ignore no-explicit-any
  const content = document.getElementById("content")! as any;

  // Initial state check
  assertEquals(content.style.display, "none");

  // Trigger interaction
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

  await settle();

  assertEquals(content.style.display, "");
});
