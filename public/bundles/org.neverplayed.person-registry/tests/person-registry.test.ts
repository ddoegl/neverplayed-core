import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "../../../../tests/test-harness.ts";
import { SESSION_SERVICE, REALM_GOVERNANCE, KNOWLEDGE_PROVIDER_SERVICE, REALM_MANAGER_SERVICE } from "core-types";

Deno.test({
    name: "Person Registry Integration Suite",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async (t) => {
        // Mock headless user BEFORE harness init to bypass Firebase redirect
        // deno-lint-ignore no-explicit-any
        (globalThis as any).NEVERPLAYED_HEADLESS_USER = {
            email: "admin@neverplayed.org",
            uid: "admin-uid",
            isSuperuser: true,
            authorized: true
        };

        const harness = new BundleTestHarness();
        // deno-lint-ignore no-explicit-any
        const context = await harness.init() as any;
        if (!context) throw new Error("Harness context missing");

        // Register mock Realm Manager
        context.registerService(REALM_MANAGER_SERVICE, {
            getActiveRealm: () => "org.neverplayed.realm.governance",
            getHierarchy: (id: string) => Promise.resolve([id])
        });

        await t.step("Install Prerequisite Bundles", async () => {
            const bundles = [
                "bundles/org.neverplayed.persistence-deno/manifest.json",
                "bundles/org.neverplayed.persistence-selector/manifest.json",
                "bundles/org.neverplayed.system-logger/manifest.json",
                "bundles/org.neverplayed.yaml-service/manifest.json",
                "bundles/org.neverplayed.persistence-resolver/manifest.json",
                "bundles/org.neverplayed.session-service/manifest.json",
                "bundles/org.neverplayed.perceiver-service/manifest.json",
                "bundles/org.neverplayed.plexus-core/manifest.json",
                "bundles/org.neverplayed.plexus-enricher/manifest.json",
                "bundles/org.neverplayed.auth-shield/manifest.json",
                "bundles/org.neverplayed.limes/manifest.json",
                "bundles/org.neverplayed.person-registry/manifest.json"
            ];
            await harness.installBundles(bundles);
            // Settle services
            await new Promise(r => setTimeout(r, 1000));
        });

        await t.step("User Session Enrichment - Regular Registered Person", async () => {
            // deno-lint-ignore no-explicit-any
            const session: any = await harness.getService(SESSION_SERVICE);
            assertExists(session, "Session service should be registered");

            // Log in and set active being focus as 'july' (registered person, not admin)
            session.login("july", "global");
            session.setBeingFocus("july");

            // Wait for Alpine reactive effects to run
            await new Promise(r => setTimeout(r, 400));

            const currentUser = session.currentUser;
            assertExists(currentUser, "Should have current user");
            assertEquals(currentUser.id, "july");
            assertEquals(currentUser.attributes?.isRegisteredPerson, true, "july should be registered");
            assertEquals(currentUser.attributes?.isPersonAdmin, false, "july should not be person admin");
        });

        await t.step("User Session Enrichment - Admin Person", async () => {
            // deno-lint-ignore no-explicit-any
            const session: any = await harness.getService(SESSION_SERVICE);
            
            // Log in and set active being focus as 'rob' (registered person, admin)
            session.login("rob", "global");
            session.setBeingFocus("rob");

            // Wait for Alpine reactive effects to run
            await new Promise(r => setTimeout(r, 400));

            const currentUser = session.currentUser;
            assertExists(currentUser, "Should have current user");
            assertEquals(currentUser.id, "rob");
            assertEquals(currentUser.attributes?.isRegisteredPerson, true, "rob should be registered");
            assertEquals(currentUser.attributes?.isPersonAdmin, true, "rob should be person admin");
        });

        await t.step("Knowledge Provider Senses Injection", async () => {
            const refs = context.getServiceReferences(KNOWLEDGE_PROVIDER_SERVICE, null);
            assertExists(refs, "Should have registered KnowledgeProviderServices");

            // Find the KnowledgeProviderService registered specifically by org.neverplayed.person-registry
            let kp: any = null;
            for (const ref of refs) {
                if (ref.getBundle().getSymbolicName() === "org.neverplayed.person-registry") {
                    kp = context.getService(ref);
                    break;
                }
            }
            assertExists(kp, "KnowledgeProviderService from person-registry should exist");

            // Context with being having admin rights and in governance realm
            const ctxAdminGov = {
                being: {
                    attributes: {
                        isPersonAdmin: true
                    }
                },
                realm: REALM_GOVERNANCE,
                surrogate: {
                    senses: [] as string[]
                }
            };

            kp.enrich(ctxAdminGov);
            assert(ctxAdminGov.surrogate.senses.includes("SensePersonhood"), "Should inject SensePersonhood in governance realm");

            // Context with being having admin rights but in another realm
            const ctxAdminOther = {
                being: {
                    attributes: {
                        isPersonAdmin: true
                    }
                },
                realm: "org.neverplayed.realm.habitat",
                surrogate: {
                    senses: [] as string[]
                }
            };

            kp.enrich(ctxAdminOther);
            assert(!ctxAdminOther.surrogate.senses.includes("SensePersonhood"), "Should not inject SensePersonhood in other realms");

            // Context with being without admin rights in governance realm
            const ctxNonAdminGov = {
                being: {
                    attributes: {
                        isPersonAdmin: false
                    }
                },
                realm: REALM_GOVERNANCE,
                surrogate: {
                    senses: [] as string[]
                }
            };

            kp.enrich(ctxNonAdminGov);
            assert(!ctxNonAdminGov.surrogate.senses.includes("SensePersonhood"), "Should not inject SensePersonhood for non-admin");
        });

        await harness.stop();
    }
});
