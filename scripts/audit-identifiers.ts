// scripts/audit-identifiers.ts
import { walk } from "https://deno.land/std@0.224.0/fs/mod.ts";

const ROOT = "./public/bundles";
const PATTERN = /@neverplayed\/|@pandino\//g;
const EXCLUDED_DIRS = ["system-services/backoffice-licenses/lib"];
const EXCLUDED_FILES = ["manifest.json"];

console.log("%c Architectural Audit: Checking for Magic Strings...", "color: blue; font-weight: bold;");

let violationCount = 0;

for await (const entry of walk(ROOT, { 
    includeDirs: false, 
    exts: [".js", ".html"] 
})) {
    if (EXCLUDED_DIRS.some(dir => entry.path.includes(dir))) continue;
    if (EXCLUDED_FILES.some(file => entry.path.endsWith(file))) continue;

    const content = await Deno.readTextFile(entry.path);
    const lines = content.split("\n");

    lines.forEach((line, index) => {
        // Simple heuristic: if the line contains a problematic pattern in a string literal
        // but it's NOT an import statement (which is allowed for packages but not for service IDs)
        // AND it's NOT in shared-types.js itself (which we are not auditing here as it's the source)
        
        // Detect problematic patterns in string literals, ignoring ES imports/exports
        // Pattern matches strings starting with @neverplayed or @pandino
        const hasPattern = PATTERN.test(line);
        if (hasPattern) {
            const isImport = /import .* from ["']/.test(line) || /export .* from ["']/.test(line) || /import\(["']/.test(line);
            if (isImport) return;
            
            violationCount++;
            console.log(`%c[VIOLATION]%c ${entry.path}:${index + 1} - Magic String detected: %c${line.trim()}`, "color: red; font-weight: bold;", "color: reset;", "color: yellow;");
        }
    });
}

if (violationCount > 0) {
    console.log(`\n%c Total Violations Found: ${violationCount}`, "color: red; font-weight: bold;");
    console.log("%c Please migrate these identifiers to public/shared-types.js", "color: gray;");
    Deno.exit(1);
} else {
    console.log("\n%c Architectural Audit: PASSED ✅", "color: green; font-weight: bold;");
    Deno.exit(0);
}
