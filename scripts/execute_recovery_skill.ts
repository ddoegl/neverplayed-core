/**
 * Autonomous Recovery Scratch Script
 * Mirrors the 'antigravity_system_recovery' MCP tool logic.
 */
import { join } from "https://deno.land/std@0.221.0/path/mod.ts";

async function runRecovery() {
    console.log("🚀 Initializing Institutional Recovery Bridge...");
    
    // 1. Boot a headless instance with the Agent
    const { default: loaderConfiguration } = await import("https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33");
    const { default: Pandino } = await import("https://esm.sh/@pandino/pandino@0.8.33/denonext/pandino.mjs");

    const pandino = new Pandino({
        ...loaderConfiguration,
        "pandino.base.url": `file://${Deno.cwd()}/public/`,
    });

    await pandino.init();
    await pandino.start();
    const context = pandino.getBundleContext();

    // 2. Install necessary bundles for auditing/recovery
    const manifests = [
        "public/bundles/org.neverplayed.system-logger/manifest.json",
        "public/bundles/org.neverplayed.persistence-deno/manifest.json",
        "public/bundles/org.neverplayed.agent.antigravity/manifest.json",
    ];

    for (const path of manifests) {
        const manifest = JSON.parse(await Deno.readTextFile(path));
        const dirPath = join(Deno.cwd(), path.substring(0, path.lastIndexOf("/")));
        if (manifest["Bundle-Activator"]) {
            manifest["Bundle-Activator"] = join(dirPath, manifest["Bundle-Activator"].replace(/^\.\//, ""));
        }
        const b = await context.installBundle(manifest);
        if (b.getState() < 32) await b.start();
    }

    // 3. Find the Agent and trigger recovery
    const agentRef = context.getServiceReferences("org.neverplayed.agent.AgentService")[0];
    if (agentRef) {
        const agent = context.getService(agentRef);
        console.log("📡 Agent found. Triggering recovery cycle...");
        const restarted = await agent.recover();
        console.log(`✅ Recovery complete. Restarted ${restarted} bundles in headless context.`);
        
        // 4. Update the Forensic Bridge (state.json)
        const statePath = join(Deno.cwd(), "public", ".neverplayed", "state.json");
        const state = JSON.parse(await Deno.readTextFile(statePath));
        
        // Update the audit log to reflect the fix
        const auditLog = state["realm.agent.antigravity_audit_log"] || [];
        auditLog.unshift({
            id: `recovery-${Date.now()}`,
            timestamp: Date.now(),
            findings: [],
            summary: "Recovery Skill executed by AI Assistant. System stabilized."
        });
        state["realm.agent.antigravity_audit_log"] = auditLog.slice(0, 50);
        
        await Deno.writeTextFile(statePath, JSON.stringify(state, null, 2));
        console.log("💾 Forensic Bridge updated with Recovery report.");
    }
}

runRecovery().catch(console.error);
