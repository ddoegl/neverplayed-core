import { assertEquals, assertExists } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { 
    SESSION_SERVICE, 
    REALM_MANAGER_SERVICE, 
    PERCEIVER_SERVICE, 
    BEING_SERVICE, 
    STRATUM_SERVICE 
} from "core-types";

// Helper to wait for reactivity and microtasks
const settle = () => new Promise(resolve => setTimeout(resolve, 300));

async function main() {
    console.log("🏛️  Starting Integration Test: Ontology Harmony...");
    const harness = new BundleTestHarness();
    
    // deno-lint-ignore no-explicit-any
    const context = await harness.init() as any;
    if (!context) {
        console.error("❌ Harness context missing");
        Deno.exit(1);
    }

    // Intercept fetch for environmental configs and YAML seed data
    const originalFetch = globalThis.fetch;
    // deno-lint-ignore no-explicit-any
    globalThis.fetch = async (url: string | URL, init?: any) => {
        const urlStr = url instanceof URL ? url.toString() : url;
        
        if (urlStr.includes("realms/index.json")) {
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve("[]"),
                json: () => Promise.resolve([]),
            } as any;
        }
        if (urlStr.includes("env.json")) {
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve("{}"),
                json: () => Promise.resolve({}),
            } as any;
        }
        if (urlStr.includes("habitat/beings.yaml")) {
            const beingsYaml = `
- id: rob
  label: Rob Richter
  email: rob@cli.local
  originRealmId: org.neverplayed.realm.habitat
  initial:
    realm: org.neverplayed.realm.habitat
    surrogate: person

- id: july
  label: July Wiser
  email: july@cli.local
  originRealmId: org.neverplayed.realm.habitat
  initial:
    realm: org.neverplayed.realm.habitat
    surrogate: person

- id: anna
  label: Anna Hobs
  email: anna@cli.local
  originRealmId: org.neverplayed.realm.governance
  initial:
    realm: org.neverplayed.realm.governance
    surrogate: person

- id: john
  label: John Mayor
  email: john@cli.local
  originRealmId: org.neverplayed.realm.habitat
  initial:
    realm: org.neverplayed.realm.habitat
    surrogate: person

- id: ghost
  label: Ghost Maker
  email: ghost@cli.local
  originRealmId: org.neverplayed.realm.habitat
  initial:
    realm: org.neverplayed.realm.habitat
    surrogate: person

- id: offline
  label: Offline Resident
  email: offline@cli.local
  originRealmId: org.neverplayed.realm.habitat
  initial:
    realm: org.neverplayed.realm.habitat
    surrogate: person
`;
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve(beingsYaml),
                json: () => Promise.resolve(beingsYaml),
            } as any;
        }
        if (urlStr.includes("governance/beings.yaml")) {
            const govBeingsYaml = `
- id: gov-gov
  label: Gov Mascot
  email: mascot@gov.local
  originRealmId: org.neverplayed.realm.governance
  initial:
    realm: org.neverplayed.realm.governance
    surrogate: maskot
`;
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve(govBeingsYaml),
                json: () => Promise.resolve(govBeingsYaml),
            } as any;
        }
        if (urlStr.includes("habitat/surrogates.yaml")) {
            const surrogatesYaml = `
- id: person
  label: Person
  senses:
    - ToolUse
    - Language
- id: guest
  label: Guest
  senses:
    - Language
`;
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve(surrogatesYaml),
                json: () => Promise.resolve(surrogatesYaml),
            } as any;
        }
        if (urlStr.includes("governance/surrogates.yaml")) {
            const govSurrogatesYaml = `
- id: person
  label: Person
  senses:
    - ToolUse
    - Language
- id: maskot
  label: Governance Mascot
  senses:
    - Language
`;
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve(govSurrogatesYaml),
                json: () => Promise.resolve(govSurrogatesYaml),
            } as any;
        }
        
        return originalFetch(url, init);
    };

    // 1. Install a mock Persistence Manager (satisfying the selector-proxy ranking filter)
    const pmStore: Record<string, unknown> = {};
    // Seed trace key for "ghost" to populate getTraceMakers()
    pmStore["identity.personhood:ghost"] = { $stigmergy: { matcher: "SensePersonhood" } };

    const pm = {
        load: (key: string) => pmStore[key] ?? null,
        store: (key: string, value: unknown) => { pmStore[key] = value; },
        waitReady: () => Promise.resolve(),
        listKeys: (_prefix: string) => Object.keys(pmStore),
        probe: (key: string) => {
            if (key.startsWith("identity.personhood:")) {
                const parts = key.split(":");
                const identityId = parts[parts.length - 1];
                return {
                    context: {
                        identityId: identityId,
                        realmId: "org.neverplayed.realm.habitat"
                    }
                };
            }
            return null;
        },
        setContext: (ctx: any) => { (pm as any).context = ctx; },
        getContext: () => (pm as any).context || { tier: "local" }
    };
    context.registerService("@pandino/persistence-manager/PersistenceManager", pm, { implementation: "selector-proxy" });

    // 2. Install infrastructure & Stratum/Stratographer bundles
    await harness.installBundles([
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/vendor/org.pandino.event-admin/manifest.json",
        "bundles/org.neverplayed.yaml-service/manifest.json",
        "bundles/org.neverplayed.alpine-bridge/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.session-service-dom/manifest.json",
        "bundles/org.neverplayed.realm-manager/manifest.json",
        "bundles/org.neverplayed.perceiver-service/manifest.json",
        "bundles/org.neverplayed.being-service/manifest.json",
        "bundles/org.neverplayed.stratum-core/manifest.json",
        "bundles/org.neverplayed.stratum-core-dom/manifest.json",
        "bundles/org.neverplayed.stratographer/manifest.json"
    ]);

    // Wait for services to bootstrap
    await settle();

    // 3. Resolve required services
    const session: any = await harness.getService(SESSION_SERVICE);
    const realmManager: any = await harness.getService(REALM_MANAGER_SERVICE);
    const perceiver: any = await harness.getService(PERCEIVER_SERVICE);
    const beingService: any = await harness.getService(BEING_SERVICE);
    const stratum: any = await harness.getService(STRATUM_SERVICE);

    assertExists(session, "Session service should be available");
    assertExists(realmManager, "Realm Manager service should be available");
    assertExists(perceiver, "Perceiver service should be available");
    assertExists(beingService, "Being Service should be available");
    assertExists(stratum, "Stratum service should be available");

    // 4. Register mock realms with their bundles list
    const mockBundles = [
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/vendor/org.pandino.event-admin/manifest.json",
        "bundles/org.neverplayed.yaml-service/manifest.json",
        "bundles/org.neverplayed.alpine-bridge/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.session-service-dom/manifest.json",
        "bundles/org.neverplayed.realm-manager/manifest.json",
        "bundles/org.neverplayed.perceiver-service/manifest.json",
        "bundles/org.neverplayed.being-service/manifest.json",
        "bundles/org.neverplayed.stratum-core/manifest.json",
        "bundles/org.neverplayed.stratum-core-dom/manifest.json",
        "bundles/org.neverplayed.stratographer/manifest.json"
    ];
    realmManager.registerRealm({
        id: "org.neverplayed.realm.habitat",
        title: "Habitat",
        bundles: mockBundles,
        seedData: {
            beings: "./realms/data/habitat/beings.yaml",
            surrogates: "./realms/data/habitat/surrogates.yaml"
        }
    });
    realmManager.registerRealm({
        id: "org.neverplayed.realm.governance",
        title: "Governance",
        bundles: mockBundles,
        seedData: {
            beings: "./realms/data/governance/beings.yaml",
            surrogates: "./realms/data/governance/surrogates.yaml"
        }
    });
    realmManager.registerRealm({
        id: "org.neverplayed.realm.empty",
        title: "Empty",
        bundles: mockBundles,
        recognizedSurrogates: ["observer"]
    });

    await settle();

    // 5. Establish Rob Richter (rob) as active observer in Habitat realm
    console.log("TEST: Switching realm to Habitat...");
    await realmManager.switchRealm("org.neverplayed.realm.habitat");
    await settle();

    console.log("TEST: Establishing 'rob' as active observer in Habitat...");
    session.login({ id: "rob", email: "rob@cli.local", originRealmId: "org.neverplayed.realm.habitat" }, "org.neverplayed.realm.habitat");
    session.activeRealmId = "org.neverplayed.realm.habitat";
    
    // Simulate DOM session-changed login event
    globalThis.dispatchEvent(new CustomEvent("session-changed", {
        detail: {
            type: "login",
            user: { id: "rob", email: "rob@cli.local" },
            surrogate: null
        }
    }));

    await settle();

    // Assert originRealmId propagation
    const currentUser = session.currentUser;
    assertExists(currentUser, "currentUser should be established");
    assertEquals(currentUser.originRealmId, "org.neverplayed.realm.habitat", "originRealmId should be correctly propagated to currentUser");
    console.log("✅ verified originRealmId propagation to currentUser");

    // 6. Log in additional active occupants
    console.log("TEST: Simulating active occupants in Habitat...");
    // July Wiser (Resident): Home is Habitat
    session.login({ id: "july", email: "july@cli.local", originRealmId: "org.neverplayed.realm.habitat" }, "org.neverplayed.realm.habitat");
    // Anna Hobs (Visitor/Transient): Home is Governance
    session.login({ id: "anna", email: "anna@cli.local", originRealmId: "org.neverplayed.realm.governance" }, "org.neverplayed.realm.habitat");
    // Restore Rob as the active observer in Habitat scope
    session.login({ id: "rob", email: "rob@cli.local", originRealmId: "org.neverplayed.realm.habitat" }, "org.neverplayed.realm.habitat");

    await settle();

    // 7. Verify Stratum Core occupants, residents alias, getTraceMakers(), and getInhabitants()
    const occupants = stratum.occupants;
    console.log("TEST: occupants =", occupants);
    assertEquals(occupants.includes("rob"), true, "rob should be an occupant");
    assertEquals(occupants.includes("july"), true, "july should be an occupant");
    assertEquals(occupants.includes("anna"), true, "anna should be an occupant");
    assertEquals(occupants.includes("ghost"), false, "ghost (trace-maker) should NOT be an occupant");
    assertEquals(occupants.includes("offline"), false, "offline should NOT be an occupant");
    console.log("✅ occupants verified");

    const residentsAlias = stratum.residents;
    assertEquals(residentsAlias.length, occupants.length, "residents alias should return occupants");
    console.log("✅ residents alias verified");

    const traceMakers = await stratum.getTraceMakers();
    console.log("TEST: traceMakers =", traceMakers);
    assertEquals(traceMakers.includes("ghost"), true, "ghost should be a trace-maker");
    assertEquals(traceMakers.includes("rob"), false, "rob should NOT be a trace-maker");
    console.log("✅ getTraceMakers() verified");

    const inhabitants = await stratum.getInhabitants();
    console.log("TEST: inhabitants =", inhabitants);
    assertEquals(inhabitants.includes("rob"), true, "rob should be an inhabitant");
    assertEquals(inhabitants.includes("july"), true, "july should be an inhabitant");
    assertEquals(inhabitants.includes("anna"), true, "anna should be an inhabitant");
    assertEquals(inhabitants.includes("ghost"), true, "ghost should be an inhabitant");
    assertEquals(inhabitants.includes("offline"), false, "offline resident should NOT be an inhabitant");
    console.log("✅ getInhabitants() verified");

    // 8. Verify Alpine store propagation
    const Alpine = (globalThis as any).Alpine;
    assertExists(Alpine, "Alpine should be globally exposed");
    
    const stratumStore = Alpine.store('stratum');
    assertExists(stratumStore, "stratum store should be registered on Alpine");
    console.log("TEST: Alpine store occupants =", stratumStore.occupants);
    assertEquals(stratumStore.occupants.includes("rob"), true, "Alpine store occupants should contain rob");
    assertEquals(stratumStore.occupants.includes("july"), true, "Alpine store occupants should contain july");
    assertEquals(stratumStore.occupants.includes("anna"), true, "Alpine store occupants should contain anna");
    console.log("✅ Alpine store occupants verified");

    // 9. Verify Stratographer topology/D3 node mapping
    const explorerStore = Alpine.store('explorer');
    assertExists(explorerStore, "explorer store should be registered on Alpine");
    
    // Refresh the topology explicitly to map the nodes
    // The explorer grounding should be set to realist to render full topology
    explorerStore.grounding = "realist";
    await explorerStore.refreshTopology();
    await settle();

    const nodes = explorerStore.nodes;
    console.log("TEST: Mapped nodes =", nodes.map((n: any) => ({ id: n.id, state: n.ontologicalState, label: n.label, color: n.color })));

    // Find the 5 nodes mapping to our 5 ontological states
    const robNode = nodes.find((n: any) => n.identityId === "rob");
    const julyNode = nodes.find((n: any) => n.identityId === "july");
    const annaNode = nodes.find((n: any) => n.identityId === "anna");
    const ghostNode = nodes.find((n: any) => n.identityId === "ghost");
    const offlineNode = nodes.find((n: any) => n.identityId === "offline");

    assertExists(robNode, "robNode must exist");
    assertExists(julyNode, "julyNode must exist");
    assertExists(annaNode, "annaNode must exist");
    assertExists(ghostNode, "ghostNode must exist");
    assertExists(offlineNode, "offlineNode must exist");

    // Assert State: Observer
    assertEquals(robNode.ontologicalState, "observer", "rob should be observer");
    assertEquals(robNode.color, "#10b981", "rob color should be emerald");
    assertEquals(robNode.opacity, 1.0, "rob opacity should be 1.0");
    assertEquals(robNode.strokeStyle, "solid", "rob strokeStyle should be solid");
    assertEquals(robNode.borderType, "double", "rob borderType should be double");
    console.log("✅ State 1: Active Observer verified");

    // Assert State: Resident
    assertEquals(julyNode.ontologicalState, "resident", "july should be resident");
    assertEquals(julyNode.color, "#a855f7", "july color should be purple");
    assertEquals(julyNode.opacity, 1.0, "july opacity should be 1.0");
    assertEquals(julyNode.strokeStyle, "solid", "july strokeStyle should be solid");
    assertEquals(julyNode.borderType, "thick", "july borderType should be thick");
    console.log("✅ State 2: Present Resident verified");

    // Assert State: Visitor
    assertEquals(annaNode.ontologicalState, "visitor", "anna should be visitor");
    assertEquals(annaNode.color, "#22d3ee", "anna color should be cyan/teal");
    assertEquals(annaNode.opacity, 1.0, "anna opacity should be 1.0");
    assertEquals(annaNode.strokeStyle, "solid", "anna strokeStyle should be solid");
    assertEquals(annaNode.borderType, "standard", "anna borderType should be standard");
    console.log("✅ State 3: Present Transient / Visitor verified");

    // Assert State: Ghost/Trace-Maker
    assertEquals(ghostNode.ontologicalState, "trace-maker", "ghost should be trace-maker");
    assertEquals(ghostNode.color, "#f59e0b", "ghost color should be amber");
    assertEquals(ghostNode.opacity, 0.6, "ghost opacity should be 0.6");
    assertEquals(ghostNode.strokeStyle, "dashed", "ghost strokeStyle should be dashed");
    assertEquals(ghostNode.borderType, "standard", "ghost borderType should be standard");
    console.log("✅ State 4: Ghost / Forensic Trace-Maker verified");

    // Assert State: Absent Resident
    assertEquals(offlineNode.ontologicalState, "offline-resident", "offline should be offline-resident");
    assertEquals(offlineNode.color, "#64748b", "offline color should be slate gray");
    assertEquals(offlineNode.opacity, 1.0, "offline opacity should be 1.0");
    assertEquals(offlineNode.strokeStyle, "dotted", "offline strokeStyle should be dotted");
    assertEquals(offlineNode.borderType, "standard", "offline borderType should be standard");
    console.log("✅ State 5: Absent Resident verified");

    // 10. Naked Grounding Shift Verification
    console.log("TEST: Establishing a surrogateless (naked) observer...");
    session.login({ id: "nakedUser", email: "naked@cli.local" }, "org.neverplayed.realm.habitat", null);
    
    // Simulate DOM session-changed login event for nakedUser
    globalThis.dispatchEvent(new CustomEvent("session-changed", {
        detail: {
            type: "login",
            user: session.currentUser,
            surrogate: null
        }
    }));
    await settle();

    // Verify initial naked observer state
    const nakedUser = session.currentUser;
    assertExists(nakedUser, "nakedUser should be established");
    assertEquals(nakedUser.id, "nakedUser", "Identity ID should be nakedUser");
    assertEquals(nakedUser.activeSurrogateId, null, "Should have no active surrogate ID");
    assertEquals(perceiver.getBeing()?.id, "nakedUser", "Perceiver being should be nakedUser");
    assertEquals(perceiver.getSurrogate(), null, "Perceiver surrogate should be null");
    assertEquals(perceiver.getObserverMode(), "idealist", "Observer mode should default to idealist");
    console.log("✅ Naked observer initial state verified");

    // Shift grounding on naked observer
    console.log("TEST: Shifting grounding to realist for naked observer...");
    session.shiftGrounding("realist", "org.neverplayed.realm.habitat");
    
    // Simulate DOM session-changed login event after shift
    globalThis.dispatchEvent(new CustomEvent("session-changed", {
        detail: {
            type: "login",
            user: session.currentUser,
            surrogate: null
        }
    }));
    await settle();

    // Verify naked observer state after grounding shift
    const shiftedUser = session.currentUser;
    assertEquals(shiftedUser.grounding, "realist", "User grounding should be updated to realist");
    assertEquals(shiftedUser.activeSurrogateId, null, "User should remain naked (activeSurrogateId = null)");
    assertEquals(perceiver.getBeing()?.grounding, "realist", "Perceiver being grounding should be realist");
    assertEquals(perceiver.getSurrogate(), null, "Perceiver surrogate should remain null");
    assertEquals(perceiver.getObserverMode(), "realist", "Perceiver observer mode should be realist");
    console.log("✅ Naked observer shift without materialization verified");

    // ==========================================
    // NEW INTEGRATION TESTS FOR TICKET-20260522-2100
    // ==========================================

    // 11. Dual-State Observer Visuals
    console.log("TEST: Seeding historical trace for 'nakedUser' to verify double-trace border style...");
    pmStore["identity.personhood:nakedUser"] = { $stigmergy: { matcher: "SensePersonhood" } };
    
    // Refresh topology to trigger dual-state styling
    await explorerStore.refreshTopology();
    await settle();

    const currentNodes = explorerStore.nodes;
    const nakedUserNode = currentNodes.find((n: any) => n.identityId === "nakedUser");
    assertExists(nakedUserNode, "nakedUser node must exist in topology");
    assertEquals(nakedUserNode.borderType, "double-trace", "Naked observer with traces must have double-trace border type");
    assertEquals(nakedUserNode.label, "Observer (with traces)", "Naked observer node label must indicate traces");
    console.log("✅ verified double-trace border style for active observer with traces");

    // 12. Active Realm Trace-Maker Inspector
    console.log("TEST: Verifying active realm trace-maker inspector...");
    const activeRealmNode = currentNodes.find((n: any) => n.id === "realm:org.neverplayed.realm.habitat");
    assertExists(activeRealmNode, "active realm node must exist");
    
    await explorerStore.inspectVault(activeRealmNode);
    await settle();
    
    const activeTraceMakers = explorerStore.activeNodeTraceMakers;
    assertExists(activeTraceMakers, "activeNodeTraceMakers must exist on store");
    assertEquals(activeTraceMakers.includes("ghost"), true, "activeNodeTraceMakers must contain ghost");
    assertEquals(activeTraceMakers.includes("nakedUser"), true, "activeNodeTraceMakers must contain nakedUser");
    console.log("✅ verified activeNodeTraceMakers population on active realm node inspection");

    // 13. Session Residency Pruning
    console.log("TEST: Performing switchRealm to Governance to verify residency pruning on previous realm...");
    // Switch to Governance realm
    await realmManager.switchRealm("org.neverplayed.realm.governance");
    await settle();

    // Check that previous realm (Habitat) occupant stack has been pruned (active user should be guest)
    const habitatActiveUser = session.scopedUsers["org.neverplayed.realm.habitat"]?.__activeId__;
    assertEquals(habitatActiveUser, "guest", "Habitat active user should have been pruned to guest");
    console.log("✅ verified residency pruning on previous realm upon transition");

    // 14. Primordial Sensation Floor & Surrogate Carry-over Verifications
    console.log("TEST: Verifying Naked Resident Primordial Sensory Floor...");
    // Create a truly naked resident in the Habitat scope
    session.login({ id: "trulyNaked", email: "naked@cli.local" }, "org.neverplayed.realm.habitat", null);
    
    // Simulate session-changed event
    globalThis.dispatchEvent(new CustomEvent("session-changed", {
        detail: {
            type: "login",
            user: session.currentUser,
            surrogate: null
        }
    }));
    await settle();
    
    // Assert trulyNaked has the Primordial sense floor
    const nakedSenses = perceiver.getEnrichedSenses();
    console.log("TEST: trulyNaked senses =", nakedSenses);
    assertEquals(nakedSenses.includes("Primordial"), true, "Naked resident must possess the Primordial sense by default");
    assertEquals(nakedSenses.includes("IdealistVision"), true, "Naked resident must possess IdealistVision under default idealist grounding");
    console.log("✅ Verified Primordial sensory floor on naked resident");

    console.log("TEST: Verifying empty realm login and surrogate carry-over...");
    // Let's set the active Being back to 'rob' (who possesses the 'person' surrogate in Habitat realm, but not 'observer')
    // We login 'rob' in Habitat so he is active with 'person' surrogate first
    session.login({ id: "rob", email: "rob@cli.local" }, "org.neverplayed.realm.habitat", { id: "person", label: "Person", senses: ["Language"] });
    session.activeRealmId = "org.neverplayed.realm.habitat";
    session.activeBeingId = "rob";
    await settle();
    
    // Now switch realm to empty.json (org.neverplayed.realm.empty) as 'rob' with no explicit surrogate parameter
    // Switch realm via realmManager
    await realmManager.switchRealm("org.neverplayed.realm.empty");
    await settle();
    
    // Rob Richter (rob) carries no compatible/recognized surrogate (empty realm only recognizes "observer")
    // Thus, his active surrogate should fall back cleanly to null (naked resident fallback)
    const emptyCurrentUser = session.currentUser;
    assertExists(emptyCurrentUser, "currentUser should exist in empty realm scope");
    assertEquals(emptyCurrentUser.id, "rob", "Active user should remain 'rob'");
    assertEquals(emptyCurrentUser.activeSurrogateId, null, "Active surrogate should be null (naked observer fallback)");
    
    // However, the Primordial sensory floor should guarantee he can still sense the bedrock
    const robEmptySenses = perceiver.getEnrichedSenses();
    console.log("TEST: rob senses in empty realm =", robEmptySenses);
    assertEquals(robEmptySenses.includes("Primordial"), true, "Rob must retain the Primordial sense floor in empty realm");
    console.log("✅ Verified empty realm login naked fallback and primordial baseline");

    console.log("\n✨ ALL ONTOLOGY HARMONY VERIFICATIONS PASSED! ✨");
    
    // Restore fetch
    globalThis.fetch = originalFetch;
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
