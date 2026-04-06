import { walk } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const BUNDLE_ROOT = "./public/bundles";
const REALM_ROOT = "./public/realms";
const PLATFORM_PATTERNS_REF = "docs/platform-patterns.md";
const ADR_REF = "docs/adr/";

console.log("%c 🏺 Never Played: Layer-Based Architectural Linter", "color: cyan; font-weight: bold; font-size: 1.2em;");
console.log("%c --------------------------------------------------", "color: gray;");

const args = Deno.args;
const targetLayer = getArgValue("--layer")?.toLowerCase();
const _targetRealmFile = getArgValue("--realm");
const isManifestOnly = args.includes("--manifest-only");
const isDocsOnly = args.includes("--docs-only");
const isFullAudit = !isManifestOnly && !isDocsOnly;

let errors = 0;
let warnings = 0;

function getArgValue(flag: string) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

// --- Realm & Layer Discovery ---

interface RealmDef {
    id: string;
    extends?: string[];
    bundles: string[];
    description?: string;
}

async function resolveBundlesForLayer(layerName: string): Promise<Set<string>> {
    const bundles = new Set<string>();
    const processedRealms = new Set<string>();

    async function processRealm(file: string) {
        if (processedRealms.has(file)) return;
        processedRealms.add(file);

        try {
            const text = await Deno.readTextFile(join(REALM_ROOT, file));
            const def: RealmDef = JSON.parse(text);
            
            // Add bundles (convert path to BSN)
            def.bundles.forEach(b => {
                if (b.startsWith("./bundles/")) {
                    const parts = b.split("/");
                    bundles.add(parts[parts.length - 2]); // BSN is the folder name
                }
            });

            // Process parents
            if (def.extends) {
                for (const parentId of def.extends) {
                    const parentFile = parentId.split(".").pop() + ".json";
                    await processRealm(parentFile);
                }
            }
        } catch (_e) {
            console.error(`%c[ERROR]%c Failed to process realm script: ${file}`, "color: red;", "color: reset;");
        }
    }

    if (layerName === "core") await processRealm("core.json");
    else if (layerName === "foundation") await processRealm("foundation.json");
    else if (layerName === "domain") {
        // Domain includes everything in index.json except the primitives? 
        // Or just all realms.
        const indexText = await Deno.readTextFile(join(REALM_ROOT, "index.json"));
        const realmFiles: string[] = JSON.parse(indexText);
        for (const f of realmFiles) await processRealm(f);
    } else {
        // Default: Audit everything found in BUNDLE_ROOT
        return new Set<string>(); 
    }

    return bundles;
}

const targetBundles = await resolveBundlesForLayer(targetLayer || "all");
if (targetBundles.size > 0) {
    console.log(`%c 🎯 Targeting Layer: ${targetLayer?.toUpperCase()} (${targetBundles.size} bundles resolved)`, "color: green;");
} else if (targetLayer) {
    console.log(`%c 🎯 Targeting Layer: ${targetLayer?.toUpperCase()} (Scanning all via convention)`, "color: yellow;");
}

async function auditBundles() {
  for await (const entry of walk(BUNDLE_ROOT, { includeDirs: true, maxDepth: 2 })) {
    if (entry.isDirectory && entry.name.startsWith("org.neverplayed.")) {
      const bsn = entry.name;
      const path = entry.path;
      
      // Filter by resolved bundles if targeting a specific layer
      if (targetBundles.size > 0 && !targetBundles.has(bsn)) continue;

      // 0. Layer Policy Enforcement (No Flows in Core/Foundation)
      if (targetLayer === "core" || targetLayer === "foundation") {
          const relativePath = path.replace(/\\/g, "/");
          if (relativePath.includes("/flows/") || relativePath.includes("/user-clients/") || relativePath.includes("/system-clients/")) {
              console.log(`%c[VIOLATION]%c ${bsn}: Flow inhabitant detected in ${targetLayer.toUpperCase()} layer!`, "color: red; font-weight: bold;", "color: reset;");
              console.log(`  Path: ${path}`);
              errors++;
          }
      }

      // 1. Manifest Alignment
      if (isFullAudit || isManifestOnly) {
        const manifestPath = `${path}/manifest.json`;
        try {
          const manifestText = await Deno.readTextFile(manifestPath);
          const manifest = JSON.parse(manifestText);
          if (manifest["Bundle-SymbolicName"] !== bsn) {
            console.log(`%c[ERROR]%c ${bsn}: Manifest BSN mismatch ('${manifest["Bundle-SymbolicName"]}')`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }
        } catch (_e) {
          console.log(`%c[ERROR]%c ${bsn}: manifest.json MISSING`, "color: red; font-weight: bold;", "color: reset;");
          errors++;
        }
      }

      // 2. Documentation Standards
      if (isFullAudit || isDocsOnly) {
        const readmePath = `${path}/README.md`;
        try {
          const readme = await Deno.readTextFile(readmePath);
          
          if (!readme.includes("## 🏛️ The Patterns")) {
            console.log(`%c[WARN]%c ${bsn}: README missing '## 🏛️ The Patterns' section`, "color: yellow; font-weight: bold;", "color: reset;");
            warnings++;
          }

          if (!readme.includes(PLATFORM_PATTERNS_REF)) {
            console.log(`%c[ERROR]%c ${bsn}: README missing link to platform-patterns.md`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

          if (!readme.includes(ADR_REF)) {
            console.log(`%c[ERROR]%c ${bsn}: README missing foundational ADR links`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

        } catch (_e) {
          console.log(`%c[ERROR]%c ${bsn}: README.md MISSING`, "color: red; font-weight: bold;", "color: reset;");
          errors++;
        }
      }
    }
  }
}

async function auditIdentifiers() {
    if (!isFullAudit) return;
    console.log("%c\n 🕵️ Scanning for Magic Strings (Drift)...", "color: blue; font-weight: bold;");
    
    const cmdArgs = ["run", "-A", "scripts/audit-identifiers.ts"];
    if (targetBundles.size > 0) {
        cmdArgs.push(`--bundles=${Array.from(targetBundles).join(",")}`);
    }

    const process = new Deno.Command("deno", {
        args: cmdArgs,
        stdout: "piped",
        stderr: "piped"
    });
    
    const { code, stdout, stderr } = await process.output();
    console.log(new TextDecoder().decode(stdout));
    console.log(new TextDecoder().decode(stderr));
    
    if (code !== 0) errors++;
    else console.log("%c Identifiers: PASSED ✅", "color: green;");
}

await auditBundles();
await auditIdentifiers();

console.log("%c\n --------------------------------------------------", "color: gray;");
if (errors > 0) {
  console.log(`%c ❌ Architectural Linter FAILED: ${errors} errors, ${warnings} warnings`, "color: red; font-weight: bold;");
  Deno.exit(1);
} else {
  console.log(`%c ✅ Architectural Linter PASSED: ${warnings} warnings detected`, "color: green; font-weight: bold;");
  Deno.exit(0);
}
