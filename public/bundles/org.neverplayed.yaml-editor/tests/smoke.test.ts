import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test({
  name: "[org.neverplayed.yaml-editor] Smoke Test: Activator Import",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Enriched DOM Polyfill for Alpine.js and Custom Elements during isolation tests
    if (!globalThis.document) {
      // @ts-ignore
      globalThis.Node = class Node {};
      // @ts-ignore
      globalThis.Element = class Element extends Node {};
      // @ts-ignore
      globalThis.HTMLElement = class HTMLElement extends Element {};
      // @ts-ignore
      globalThis.document = {
        createElement: () => ({ 
          style: {}, 
          appendChild: () => {}, 
          addEventListener: () => {},
          setAttribute: () => {},
          innerText: ''
        }),
        createTextNode: () => ({}),
        documentElement: { style: {} },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
        body: { appendChild: () => {} }
      };
      // @ts-ignore
      globalThis.MutationObserver = class { observe() {} disconnect() {} };
      // @ts-ignore
      globalThis.window = globalThis;
      // @ts-ignore
      globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      // @ts-ignore
      globalThis.CustomEvent = class { constructor(name, data) { this.detail = data?.detail; } };
      // @ts-ignore: Corrected mock for atomic component registration
      globalThis.customElements = { get: () => null, define: () => {} };
    }

    const modulePath = "../activator.js";
    const { default: Activator } = await import(modulePath);
    assertEquals(typeof Activator, "function", "Activator must export a class constructor");
  }
});
