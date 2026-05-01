import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Persistence Sovereignty Test
 * Verifies that 'unknown' realm artifacts are pruned during context shift
 * while preserving core identity state.
 */
Deno.test({
  name: "[org.neverplayed.persistence-selector] Sovereignty: Limbo Pruning",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // 1. Mock Environment
    const storageMap = new Map<string, string>();
    const storageMock = {
      getItem: (k: string) => storageMap.get(k) || null,
      setItem: (k: string, v: string) => {
          storageMap.set(k, v);
      },
      removeItem: (k: string) => storageMap.delete(k),
      get length() { return storageMap.size; },
      key: (i: number) => Array.from(storageMap.keys())[i]
    };

    // @ts-ignore
    Object.defineProperty(globalThis, 'localStorage', {
        value: storageMock,
        writable: true,
        configurable: true
    });
    // @ts-ignore
    globalThis.CustomEvent = class { constructor(n: string, d: any) { this.detail = d?.detail; } };
    // @ts-ignore
    globalThis.dispatchEvent = () => {};

    const { default: Selector } = await import("../activator.js");
    const { default: LocalStorageProvider } = await import("../../org.neverplayed.persistence-localstorage/activator.js");

    const selector = new Selector();
    const provider = new LocalStorageProvider();

    // 2. Mock OSGi Context
    let registeredService: any = null;
    const mockBundle = { 
      getSymbolicName: () => "test.bundle",
      getHeaders: () => ({}),
      getLocation: () => "/test.bundle",
      getState: () => 32 // ACTIVE
    };

    const mockContext = {
      getBundle: () => mockBundle,
      trackService: (filter: string, hooks: any) => {
        return { open: () => {
            if (filter.includes("PersistenceManager")) {
                hooks.addingService({ 
                    getProperty: (p: string) => p === "persistence.tier" ? "local" : 0,
                    bundle: { getSymbolicName: () => "test.provider" }
                });
            }
        }, close: () => {} };
      },
      registerService: (name: string, svc: any) => {
          if (name === "@pandino/persistence-manager/PersistenceManager") {
              if (registeredService === null) { 
                  registeredService = svc;
              } else {
                  selector.pm = svc;
              }
          }
      },
      getService: (ref: any) => registeredService,
      getServiceReference: () => null
    };

    // 3. Start System
    // @ts-ignore
    await provider.start(mockContext);
    // @ts-ignore
    await selector.start(mockContext);

    // 4. Setup Limbo State (unknown realm)
    await selector.setContext({ tenantId: "guest", realmId: "unknown", identityId: "guest" });
    await selector.store("limbo.key", "i-should-die");
    await selector.store("pandino.session.state", "i-should-live");

    // Verify they exist in physical storage
    assertEquals(storageMap.has("np:v1:guest:unknown:guest:limbo.key"), true, "Limbo key should exist physically");
    assertEquals(storageMap.has("np:v1:guest:unknown:guest:pandino.session.state"), true, "Session key should exist physically");

    // 5. Context Shift (unknown -> resolved)
    await selector.setContext({ tenantId: "ddoegl", realmId: "org.neverplayed.realm.real-life", identityId: "ddoegl" });

    // 6. Verify Pruning
    assertEquals(storageMap.has("np:v1:guest:unknown:guest:limbo.key"), false, "Limbo key should be PRUNED");
    assertEquals(storageMap.has("np:v1:guest:unknown:guest:pandino.session.state"), true, "Session key should be PRESERVED");
  }
});
