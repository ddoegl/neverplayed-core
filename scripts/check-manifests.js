#!/usr/bin/env deno run --allow-read
/**
 * NeverPlayed Bundle QA Script (Manifests)
 * Enforces the Gold Standard Manifest Specification.
 */

import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { dirname, basename, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const BUNDLE_ROOT = "./public/bundles";
const BSN_PREFIX = "org.neverplayed.";

const violations = [];
const smells = [];

console.log("🌌 NeverPlayed Manifest QA Initializing...");

for await (const entry of walk(BUNDLE_ROOT, { 
    includeFiles: true, 
    includeDirs: false,
    maxDepth: 3,
    exts: ["json"] 
})) {
    if (basename(entry.path) !== "manifest.json") continue;

    const path = entry.path;
    const dir = dirname(path);
    const dirName = basename(dir);
    
    try {
        const manifest = JSON.parse(await Deno.readTextFile(path));
        const bsn = manifest["Bundle-SymbolicName"];
        const version = manifest["Bundle-Version"];
        const activator = manifest["Bundle-Activator"];
        const name = manifest["Bundle-Name"] || manifest["name"]; // Backward compat check
        const description = manifest["Bundle-Description"] || manifest["description"];

        const reportId = bsn || path;

        // 1. Prefix Violation
        if (bsn && !bsn.startsWith(BSN_PREFIX)) {
            smells.push(`[${reportId}] BSN '${bsn}' does not use official prefix '${BSN_PREFIX}'.`);
        }

        // 2. Directory Mismatch
        if (bsn && bsn !== dirName) {
            violations.push(`[${reportId}] Directory name '${dirName}' must match BSN '${bsn}'.`);
        }

        // 3. Versions
        if (!version) {
            violations.push(`[${reportId}] Missing 'Bundle-Version'.`);
        } else if (version === "0.0.1") {
            smells.push(`[${reportId}] Placeholder '0.0.1' detected. Please update to 1.0.0.`);
        }

        // 4. Metadata
        if (!name) smells.push(`[${reportId}] Missing 'Bundle-Name'.`);
        if (!description) smells.push(`[${reportId}] Missing bundle description.`);

        // 5. Activator Format
        if (activator && activator.startsWith("./")) {
            smells.push(`[${reportId}] 'Bundle-Activator' uses legacy './' prefix. Use clean 'activator.js'.`);
        }

        // 6. Activator Presence
        if (activator) {
            const activatorPath = join(dir, activator);
            try {
                await Deno.stat(activatorPath);
            } catch {
                violations.push(`[${reportId}] Activator path '${activatorPath}' not found!`);
            }
        }

    } catch (err) {
        violations.push(`[${path}] CRITICAL: JSON Parse Error: ${err.message}`);
    }
}

// 2. CORE TYPES VALIDATION
const CORE_TYPES_PATH = "./public/core-types.js";
try {
    const content = await Deno.readTextFile(CORE_TYPES_PATH);
    const lines = content.split('\n');
    
    // Regex for export const NAME = "VALUE";
    const constRegex = /export const ([A-Z0-9_]+)\s*=\s*"(.*)";/;

    lines.forEach((line, index) => {
        const match = line.match(constRegex);
        if (!match) return;

        const [_, name, value] = match;
        const lineNo = index + 1;
        const reportId = `core-types:${lineNo}`;

        // Rule 1: PIDs
        if (name.endsWith("_PID")) {
            if (!value.startsWith("org.neverplayed.") || value.includes("/") || value.includes("-")) {
                 smells.push(`[${reportId}] PID '${name}' value '${value}' should be 'org.neverplayed.<subsystem>.<component>' (dot-separated, lowercase).`);
            }
        }

        // Rule 2: Service Interfaces
        if (name.endsWith("_SERVICE")) {
            // Pandino/External exceptions
            if (value.startsWith("@pandino/")) return;

            if (!value.startsWith("org.neverplayed.")) {
                smells.push(`[${reportId}] Service '${name}' value '${value}' missing 'org.neverplayed.' prefix.`);
            }
            if (value.includes("/") || value.includes("-")) {
                smells.push(`[${reportId}] Service '${name}' value '${value}' uses legacy characters. Use 'org.neverplayed.<domain>.<Interface>'.`);
            }
        }

        // Rule 3: Event Topics
        if (name.endsWith("_TOPIC")) {
            // OSGi Standard Property exception
            if (name === "EVENT_TOPIC") return;

            if (!value.startsWith("org/neverplayed/")) {
                smells.push(`[${reportId}] Topic '${name}' value '${value}' should start with 'org/neverplayed/'.`);
            }
        }
    });

} catch (err) {
    violations.push(`[core-types.js] CRITICAL: Could not read core-types: ${err.message}`);
}

console.log("\n--- QA REPORT ---\n");

if (smells.length > 0) {
    console.log("🟡 SMELLS (Best Practice Gaps):");
    smells.forEach(s => console.log(`  - ${s}`));
}

if (violations.length > 0) {
    console.log("\n🔴 VIOLATIONS (Breaking Standard):");
    violations.forEach(v => console.log(`  - ${v}`));
}

if (violations.length === 0 && smells.length === 0) {
    console.log("✅ ALL BUNDLES MEET GOLD STANDARDS.");
} else {
    console.log(`\nSummary: ${violations.length} violations, ${smells.length} smells.`);
    if (violations.length > 0) Deno.exit(1);
}
