/**
 * @file Activator for org.neverplayed.test.persistence
 * @module platform/bundles/org.neverplayed.test.persistence
 */

import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _pm = null;

    onStart(context) {
        this.logger.info("🧪 Persistence Test Suite: Initializing...");

        context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(implementation=selector-proxy))`, {
            addingService: (ref) => {
                this._pm = context.getService(ref);
                this._runSuite();
                return this._pm;
            },
            removedService: () => { this._pm = null; }
        }).open();
    }

    async _runSuite() {
        this.logger.info("🧪 Persistence Test Suite: Running Assurances...");
        let passed = 0;
        let failed = 0;

        const assert = (condition, msg) => {
            if (condition) {
                this.logger.debug(` ✅ PASS: ${msg}`);
                passed++;
            } else {
                this.logger.error(` ❌ FAIL: ${msg}`);
                failed++;
            }
        };

        try {
            // Setup Context State memory
            const originalContext = this._pm.getContext() || { tenantId: "guest", realmId: "unknown", identityId: "guest" };

            // --- Test 1: Private Boundary Isolation ---
            await this._pm.setContext({ tenantId: "test", realmId: "test-realm", identityId: "alice" });
            await this._pm.store("private-test", "Alice Secret");

            await this._pm.setContext({ tenantId: "test", realmId: "test-realm", identityId: "bob" });
            const bobReadPrivate = await this._pm.load("private-test");
            assert(bobReadPrivate === null || bobReadPrivate === undefined, "Identity B cannot read Identity A's private trace");

            // --- Test 2: Shared Boundary Penetration ---
            await this._pm.setContext({ tenantId: "test", realmId: "test-realm", identityId: "alice" });
            await this._pm.store("shared:shared-test", "Realm Secret");

            await this._pm.setContext({ tenantId: "test", realmId: "test-realm", identityId: "bob" });
            const bobReadShared = await this._pm.load("shared:shared-test");
            assert(bobReadShared === "Realm Secret", "Identity B can read Identity A's shared trace in the same realm");

            // --- Test 3: Realm Isolation for Shared ---
            await this._pm.setContext({ tenantId: "test", realmId: "foreign-realm", identityId: "charlie" });
            const charlieReadShared = await this._pm.load("shared:shared-test");
            assert(charlieReadShared === null || charlieReadShared === undefined, "Identity in Foreign Realm cannot read Shared trace of another realm");

            // --- Test 4: Global Boundary Penetration ---
            await this._pm.setContext({ tenantId: "test", realmId: "test-realm", identityId: "alice" });
            await this._pm.store("global:global-test", "Tenant Secret");

            await this._pm.setContext({ tenantId: "test", realmId: "foreign-realm", identityId: "charlie" });
            const charlieReadGlobal = await this._pm.load("global:global-test");
            assert(charlieReadGlobal === "Tenant Secret", "Identity in Foreign Realm CAN read Global trace of the same tenant");

            // Cleanup Test Artifacts
            await this._pm.setContext({ tenantId: "test", realmId: "test-realm", identityId: "alice" });
            await this._pm.store("private-test", null);
            await this._pm.store("shared:shared-test", null);
            await this._pm.store("global:global-test", null);

            // Restore Original Context
            await this._pm.setContext(originalContext);

            this.logger.info(`🧪 Test Suite Completed. PASS: ${passed} | FAIL: ${failed}`);

        } catch (err) {
            this.logger.error(`🧪 Test Suite Error: ${err.message}`, err);
        }
    }

    onStop() {
        this.logger.info("🧪 Persistence Test Suite: Stopped.");
    }
}
