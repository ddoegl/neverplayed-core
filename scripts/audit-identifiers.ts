// scripts/audit-identifiers.ts
import { walk } from "https://deno.land/std@0.224.0/fs/mod.ts";

const ROOT = "./public/bundles";
const PATTERN = /@neverplayed\/|@pandino\/|org\.neverplayed\./g;
// Only match if the value is a string literal (starts with a quote)
const FLOW_PATTERN = /(selectFlow|isFlowEnabled|launchFlow)\(["']|["']flow\.id["']\s*:\s*["']|getProperty\(["']flow\.id["']\)\s*===\s*["']|["']flowType["']\s*:\s*["']/g;

const EXCLUDED_DIRS = ["system-services/backoffice-licenses/lib"];
const EXCLUDED_FILES = ["manifest.json"];

console.log("%c Architectural Audit: Checking for Magic Strings...", "color: blue; font-weight: bold;");

const bundleArg = Deno.args.find(arg => arg.startsWith("--bundles="))?.split("=")[1];
const allowedBundles = bundleArg ? new Set(bundleArg.split(",")) : null;

let violationCount = 0;

for await (const entry of walk(ROOT, { 
    includeDirs: false, 
    exts: [".js", ".html"] 
})) {
    if (EXCLUDED_DIRS.some(dir => entry.path.includes(dir))) continue;
    if (EXCLUDED_FILES.some(file => entry.path.endsWith(file))) continue;

    // Filter by allowed bundles
    if (allowedBundles) {
        const isAllowed = Array.from(allowedBundles).some(bsn => entry.path.includes(`/${bsn}/`));
        if (!isAllowed) continue;
    }

    const content = await Deno.readTextFile(entry.path);
    const lines = content.split("\n");

    lines.forEach((line, index) => {
        // Detect problematic patterns
        const hasNamespacePattern = PATTERN.test(line);
        const hasFlowPattern = FLOW_PATTERN.test(line);
        
        if (hasNamespacePattern || hasFlowPattern) {
            // Ignore ES imports/exports
            const isImport = /import .* from ["']/.test(line) || /export .* from ["']/.test(line) || /import\(["']/.test(line);
            if (isImport) return;

            // ALLOWance: If the string is "Structured" (contains colon or internal slash), it's not a Magic String
            // Heuristic: Must be inside quotes and contain : or / (but not just @neverplayed/ prefix)
            const stringMatches = line.match(/["'](.*?)["']/g);
            if (stringMatches) {
                const isStructured = stringMatches.some(s => {
                    const inner = s.slice(1, -1);
                    // Allow if it contains a namespace colon or a path slash (and isn't just the package prefix)
                    return (inner.includes(':') || (inner.includes('/') && !inner.startsWith('@'))) 
                        && !inner.startsWith('@neverplayed/') 
                        && !inner.startsWith('@pandino/');
                });
                if (isStructured) return;
            }

            violationCount++;
            console.log(`%c[VIOLATION]%c ${entry.path}:${index + 1} - Magic String detected: %c${line.trim()}`, "color: red; font-weight: bold;", "color: reset;", "color: yellow;");
        }
    });
}

if (violationCount > 0) {
    console.log(`\n%c Total Violations Found: ${violationCount}`, "color: red; font-weight: bold;");
    console.log("%c Please migrate these identifiers to public/core-types.js or use Namespaced Identifiers (e.g. 'pkg:id')", "color: gray;");
    Deno.exit(1);
} else {
    console.log("\n%c Architectural Audit: PASSED ✅", "color: green; font-weight: bold;");
    Deno.exit(0);
}
