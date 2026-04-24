import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import "../../../../scripts/test-harness-globals.ts";
import { PandinoHarness } from "../../../../scripts/pandino-test-harness.ts";
import { STRATUM_SERVICE, SESSION_SERVICE, PERSISTENCE_MANAGER_SERVICE } from "../../../core-types.js";

Deno.test({
    name: "Stratum Explorer: Topology Mapping & Pulse Verification",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        // Dynamic Hydration of Alpine to ensure DOM is ready
        const AlpineModule = await import("https://esm.sh/alpinejs@3.13.5");
        const Alpine = AlpineModule.default;
        // @ts-ignore: TDD Pivot
        globalThis.Alpine = Alpine;

        const harness = new PandinoHarness();
        await harness.init();

        interface StratumService {
            tenantId: string;
            identityId: string;
            realmId: string;
            tier: string;
        }

        interface ExplorerStore {
            nodes: Array<{ id: string, label: string, value: string }>;
            visible: boolean;
            refreshTopology(): void;
        }
        interface AlpineGlobal {
            Alpine: {
                store: (name: string, value?: unknown) => ExplorerStore;
            }
        }

        // 1. Boot Minimal Stratum Infrastructure
        console.log("TDD: Booting Minimal Stratum Infrastructure...");
        await harness.installBundle("./org.neverplayed.session-service/manifest.json");
        await harness.installBundle("./org.neverplayed.persistence-selector/manifest.json");
        await harness.installBundle("./org.neverplayed.stratum-core/manifest.json");
        
        // 2. Register Mock Persistence to satisfy selector
        harness.registerMockPersistence("local", "mock-local-storage");
        
        // 3. Install Explorer Bundle
        const bsn = "org.neverplayed.stratum-explorer";
        await harness.installBundle(`./${bsn}/manifest.json`);
        await harness.settle(1500);

        // 4. Verify Initial Topology
        const g = (globalThis as unknown) as AlpineGlobal;
        const explorer = g.Alpine.store('explorer');
        
        // Wait for Stratum Service to be ready
        await harness.waitForService(STRATUM_SERVICE);
        explorer.refreshTopology();

        console.log("TDD: Initial Explorer Nodes:", explorer.nodes.length);
        assertEquals(explorer.nodes.length, 4, "Explorer must map all 4 primary Strati dimensions");

        // 4. Verify Identity Specifics (Default is guest)
        const tenantNode = explorer.nodes.find(n => n.id === 'tenant');
        assertEquals(tenantNode?.value, "guest", "Initial topology must reflect current tenantId");

        // 5. Simulate System Shunt (Real Service Mutation)
        console.log("TDD: Simulating System Shunt (Identity Pivot)...");
        explorer.visible = true; 
        
        interface SessionService {
            scopedUsers: { global: { id: string } };
            currentUser: { id: string };
        }
        interface PersistenceSelector {
            setContext(ctx: Record<string, string>): Promise<void>;
        }

        const session = await harness.waitForService<SessionService>(SESSION_SERVICE);
        const pm = await harness.waitForService<PersistenceSelector>(PERSISTENCE_MANAGER_SERVICE, "(implementation=selector-proxy)");
        
        // Mutate Session (StratumCore reads from here)
        session.scopedUsers.global = { id: "active-user" };
        
        // Mutate PM Context (Triggers the event and the Pulse)
        await pm.setContext({ tenantId: "active-user", identityId: "active-user", tier: "cloud" });

        await harness.settle(500);
        
        // Final Assertion: Topology should have updated its values
        const updatedTenant = explorer.nodes.find(n => n.id === 'tenant');
        console.log("TDD: Post-Shunt Tenant Value:", updatedTenant?.value);
        assertEquals(updatedTenant?.value, "active-user", "Topology must reactively update values after shunt");

        await harness.stop();
        console.log("Stratum Explorer TDD: Optical Accuracy Verified. 🪐🛡️🔍✅");
    }
});
