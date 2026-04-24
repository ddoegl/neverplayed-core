import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

/**
 * Stratum UI Test Suite
 * Validates the view-model logic for the Stratum HUD.
 */

Deno.test("Stratum UI: HUD View Model should correctly map services", () => {
    // 1. Mock Stratum Service
    const mockStratum = {
        tenantId: "daniel",
        identityId: "admin",
        realmId: "core",
        flowId: "shell",
        tier: "local",
        toURI: () => "np://daniel/admin/core/shell?tier=local"
    };

    // 2. HUD Component Logic (to be moved to activator/template)
    const createHUDViewModel = (stratum: { 
        tenantId: string; 
        identityId: string; 
        realmId: string; 
        flowId: string; 
        tier: string; 
        toURI: () => string 
    }) => ({
        get facetList() {
            return [
                { label: 'WHO', value: stratum.identityId, sub: stratum.tenantId, icon: 'fas fa-user-shield' },
                { label: 'WHERE', value: stratum.realmId, sub: stratum.flowId, icon: 'fas fa-universe' },
                { label: 'HOW', value: stratum.tier.toUpperCase(), sub: 'Persistence Strategy', icon: 'fas fa-layer-group' }
            ];
        },
        get uri() {
            return stratum.toURI();
        },
        get tierColor() {
            return stratum.tier === 'cloud' ? 'text-amber-400' : 'text-cyan-400';
        }
    });

    // 3. Execution
    const vm = createHUDViewModel(mockStratum);

    // 4. Assertions
    assertEquals(vm.facetList[0].value, "admin");
    assertEquals(vm.facetList[1].value, "core");
    assertEquals(vm.tierColor, "text-cyan-400");
    assertEquals(vm.uri, "np://daniel/admin/core/shell?tier=local");
});
