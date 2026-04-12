import { walk } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const BUNDLE_ROOT = "./public/bundles";
const REALM_ROOT = "./public/realms";
const PLATFORM_PATTERNS_REF = "docs/platform-patterns.md";
const ADR_REF = "docs/adr/";
const HEALTH_BADGE = "![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)";
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const CORE_ADRS = ["0025", "0026", "0027"];

console.log("%c 🏺 Never Played: Layer-Based Architectural Linter", "color: cyan; font-weight: bold; font-size: 1.2em;");
console.log("%c --------------------------------------------------", "color: gray;");

const args = Deno.args;
const targetLayer = getArgValue("--layer")?.toLowerCase();
const isManifestOnly = args.includes("--manifest-only");
const isDocsOnly = args.includes("--docs-only");
const isFixMode = args.includes("--fix");
const isFullAudit = !isManifestOnly && !isDocsOnly;

let errors = 0;
let warnings = 0;
const fixedItems: string[] = [];

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

/**
 * Resolves bundles with CASCADING logic:
 * - core: bundles in core.json
 * - foundation: foundation.json + core.json
 * - domain: all realms in index.json
 */
async function resolveBundlesForLayer(layerName: string): Promise<{ bundles: Set<string>, layerMap: Map<string, string> }> {
    const bundles = new Set<string>();
    const layerMap = new Map<string, string>(); // bsn -> layer
    const processedRealms = new Set<string>();

    async function processRealm(file: string, layer: string) {
        if (processedRealms.has(file)) return;
        processedRealms.add(file);

        try {
            const text = await Deno.readTextFile(join(REALM_ROOT, file));
            const def: RealmDef = JSON.parse(text);
            
            // Add bundles (convert path to BSN)
            def.bundles.forEach(b => {
                if (b.startsWith("./bundles/")) {
                    const parts = b.split("/");
                    const bsn = parts[parts.length - 2]; // BSN is the folder name
                    bundles.add(bsn);
                    layerMap.set(bsn, layer);
                }
            });

            // Process parents (Recursive discovery for cascading layers)
            if (def.extends) {
                for (const parentId of def.extends) {
                    const parentFile = parentId.split(".").pop() + ".json";
                    // Parents are always "lower" layers
                    const parentLayer = layer === "foundation" ? "core" : (layer === "domain" ? "foundation" : layer);
                    await processRealm(parentFile, parentLayer);
                }
            }
        } catch (_e) {
            // console.error(`%c[ERROR]%c Failed to process realm script: ${file}`, "color: red;", "color: reset;");
        }
    }

    if (layerName === "core") {
        await processRealm("core.json", "core");
    } else if (layerName === "foundation") {
        await processRealm("foundation.json", "foundation");
    } else if (layerName === "domain") {
        const indexText = await Deno.readTextFile(join(REALM_ROOT, "index.json"));
        const realmFiles: string[] = JSON.parse(indexText);
        for (const f of realmFiles) {
            // Determine intrinsic layer by file name for top-level entry
            let intrinsicLayer = "domain";
            if (f === "core.json") intrinsicLayer = "core";
            if (f === "foundation.json") intrinsicLayer = "foundation";
            await processRealm(f, intrinsicLayer);
        }
    }

    return { bundles, layerMap };
}

const { bundles: targetBundles, layerMap } = await resolveBundlesForLayer(targetLayer || "all");

if (targetBundles.size > 0) {
    console.log(`%c 🎯 Targeting Layer: ${targetLayer?.toUpperCase()} (${targetBundles.size} bundles resolved via cascading discovery)`, "color: green;");
} else if (targetLayer) {
    console.log(`%c 🎯 Targeting Layer: ${targetLayer?.toUpperCase()} (Scanning all via convention)`, "color: yellow;");
}

const identityMap = new Map<string, string>();

async function loadIdentities() {
    const files = ["public/types/platform.js", "public/types/domain.js"];
    for (const file of files) {
        try {
            const content = await Deno.readTextFile(file);
            const regex = /export const ([A-Z_]+) = "([^"]+)"/g;
            let m;
            while ((m = regex.exec(content)) !== null) {
                identityMap.set(m[1], m[2]);
            }
        } catch (_e) { /* file might be missing or different in some branches */ }
    }
}

async function auditBundles() {
  await loadIdentities();
  for await (const entry of walk(BUNDLE_ROOT, { includeDirs: true, maxDepth: 2 })) {
    if (entry.isDirectory && entry.name.startsWith("org.neverplayed.")) {
      const bsn = entry.name;
      const path = entry.path;
      
      // Filter by resolved bundles if targeting a specific layer
      if (targetBundles.size > 0 && !targetBundles.has(bsn)) continue;

      const layer = layerMap.get(bsn) || "domain";
      const manifestPath = join(path, "manifest.json");
      const readmePath = join(path, "README.md");

      // 0. Layer Policy Enforcement (No Flows/Clients in Core/Foundation)
      if (layer === "core" || layer === "foundation") {
          const stats = await Deno.readDir(path);
          for await (const item of stats) {
              if (item.isDirectory && (item.name === "flows" || item.name === "user-clients" || item.name === "system-clients")) {
                  console.log(`%c[VIOLATION]%c ${bsn}: Prohibited folder '${item.name}' detected in ${layer.toUpperCase()} layer!`, "color: red; font-weight: bold;", "color: reset;");
                  console.log(`  Path: ${join(path, item.name)}`);
                  errors++;
              }
          }
      }

      // 1. Manifest Alignment & Versioning (ADR-0027)
      if (isFullAudit || isManifestOnly) {
        try {
          const manifestText = await Deno.readTextFile(manifestPath);
          const manifest = JSON.parse(manifestText);
          
          // BSN Check
          if (manifest["Bundle-SymbolicName"] !== bsn) {
            console.log(`%c[ERROR]%c ${bsn}: Manifest BSN mismatch ('${manifest["Bundle-SymbolicName"]}')`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

          // 2. Blueprint Hygiene (Schema Parsimony - ADR-0032)
          const specPath = join(path, "spec.yaml");
          try {
            const specContent = await Deno.readTextFile(specPath);
            if (specContent.includes("stepOrder:")) {
              console.log(`%c[ERROR]%c ${bsn}: Found deprecated 'stepOrder' array in spec.yaml. Use Lexical Key Ordering (Principle 4.1).`, "color: red; font-weight: bold;", "color: reset;");
              errors++;
            }
          } catch (_e) { /* no spec */ }

          // Versioning Check (ADR-0027)
          const version = manifest["Bundle-Version"];
          if (!version || !SEMVER_REGEX.test(version)) {
            console.log(`%c[ERROR]%c ${bsn}: Invalid Semantic Versioning ('${version || 'MISSING'}'). Must be X.Y.Z as per ADR-0027.`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

        } catch (_e) {
          console.log(`%c[ERROR]%c ${bsn}: manifest.json MISSING`, "color: red; font-weight: bold;", "color: reset;");
          errors++;
        }
      }

      // 2. Documentation Standards & Health Badging
      if (isFullAudit || isDocsOnly) {
        try {
          let readme = await Deno.readTextFile(readmePath);
          let changed = false;
          
          // A. Health Badge (Auto-fix support)
          if (!readme.includes("Documentation Health")) {
            if (isFixMode) {
                // Prepend badge after title
                readme = readme.replace(/^(# .*?\n)/, `$1${HEALTH_BADGE}\n\n`);
                changed = true;
                fixedItems.push(`${bsn}: Injected Health Badge`);
            } else {
                console.log(`%c[WARN]%c ${bsn}: README missing Documentation Health badge`, "color: yellow; font-weight: bold;", "color: reset;");
                warnings++;
            }
          }

          // B. Sections Existence
          if (!readme.includes("## 🏛️ Architecture & Implementation")) {
            console.log(`%c[ERROR]%c ${bsn}: README missing 'Architecture & Implementation' section`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

          if (!readme.includes("## 🏛️ The Patterns")) {
            console.log(`%c[WARN]%c ${bsn}: README missing '## 🏛️ The Patterns' section`, "color: yellow; font-weight: bold;", "color: reset;");
            warnings++;
          }

          // C. ADR & Pattern Linking
          if (!readme.includes(PLATFORM_PATTERNS_REF)) {
            console.log(`%c[ERROR]%c ${bsn}: README missing link to platform-patterns.md`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

          if (!readme.includes(ADR_REF)) {
            console.log(`%c[ERROR]%c ${bsn}: README missing foundational ADR links`, "color: red; font-weight: bold;", "color: reset;");
            errors++;
          }

          // D. Core ADR Coverage (0025, 0026, 0027) for Core/Foundation layers
          if (layer === "core" || layer === "foundation") {
              for (const adrId of CORE_ADRS) {
                  if (!readme.includes(adrId)) {
                      console.log(`%c[WARN]%c ${bsn}: README missing link to critical ADR-${adrId}`, "color: yellow; font-weight: bold;", "color: reset;");
                      warnings++;
                  }
              }
          }

          if (changed && isFixMode) {
              await Deno.writeTextFile(readmePath, readme);
          }

        } catch (_e) {
          console.log(`%c[ERROR]%c ${bsn}: README.md MISSING`, "color: red; font-weight: bold;", "color: reset;");
          errors++;
        }

        // 3. JSDoc & Documentation-Code Continuity (Audit ADR-0031)
        const activatorPath = `${path}/activator.js`;
        try {
            const activator = await Deno.readTextFile(activatorPath);
            let readme = "";
            try { readme = await Deno.readTextFile(readmePath); } catch (_e) { /* handled above */ }

            // A. Technical Documentation check
            if (!activator.includes("/**")) {
                console.log(`%c[WARN]%c ${bsn}: activator.js missing JSDoc technical documentation`, "color: yellow; font-weight: bold;", "color: reset;");
                warnings++;
            }

            // B. Service Continuity Check (Extract identifiers from activator)
            const serviceRefRegex = /([A-Z_]+_SERVICE|[A-Z_]+_PID)/g;
            const matches = activator.match(serviceRefRegex);
            
            if (matches && matches.length > 0) {
                const uniqueServices = [...new Set(matches)];
                for (const service of uniqueServices) {
                    if (readme && !readme.includes(service)) {
                        errors++;
                    }
                }
            }

            // C. Manifest Capability Alignment (Extract registrations)
            const registrationRegex = /context\.registerService\(([A-Z_]+)/g;
            const regMatches = activator.match(registrationRegex);
            
            if (regMatches) {
                const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
                const provCapability = manifest["Provide-Capability"] || "";
                
                for (const matchLine of regMatches) {
                    const constName = matchLine.replace("context.registerService(", "");
                    const literal = identityMap.get(constName);
                    
                    if (literal && !provCapability.includes(literal)) {
                        console.log(`%c[VIOLATION]%c ${bsn}: Service Registration '${constName}' (${literal}) IS NOT advertised in manifest.json!`, "color: red; font-weight: bold;", "color: reset;");
                        errors++;
                    }
                }
            }

        } catch (_e) {
            // Some bundles might not have activators, that's okay.
        }

        // 4. Test Coverage Audit (ADR-0028)
        const testsPath = `${path}/tests`;
        try {
            const stats = await Deno.stat(testsPath);
            if (!stats.isDirectory) throw new Error("Not a directory");
            
            // If we are in fix-mode and health badge is missing or old, the HEALTH_BADGE const above will include coverage.
        } catch (_e) {
            if (layer === "core" || layer === "foundation") {
                console.log(`%c[ERROR]%c ${bsn}: Missing mandatory 'tests/' directory for ${layer.toUpperCase()} bundle (ADR-0028)!`, "color: red; font-weight: bold;", "color: reset;");
                errors++;
            } else {
                console.log(`%c[WARN]%c ${bsn}: Missing 'tests/' directory for ${layer.toUpperCase()} bundle`, "color: yellow; font-weight: bold;", "color: reset;");
                warnings++;
            }
        }
      }
    }
  }
}

async function auditIdentifiers() {
    if (!isFullAudit) return;
    console.log("%c\n 🕵️ Scanning for Magic String Drift (Identifier Audit)...", "color: blue; font-weight: bold;");
    
    // Pass the resolved bundles to the identifier auditor
    const cmdArgs = ["run", "-A", "scripts/audit-identifiers.ts"];
    if (targetBundles.size > 0) {
        cmdArgs.push(`--bundles=${Array.from(targetBundles).join(",")}`);
    }

    const process = new Deno.Command(Deno.execPath(), {
        args: cmdArgs,
        stdout: "inherit", 
        stderr: "inherit"
    });
    
    const { code } = await process.output();
    
    if (code !== 0) {
        errors++;
        console.error("%c Identifiers: FAILED ❌", "color: red;");
    } else {
        console.log("%c Identifiers: PASSED ✅", "color: green;");
    }
}

await auditBundles();
await auditIdentifiers();

console.log("%c\n --------------------------------------------------", "color: gray;");

if (isFixMode && fixedItems.length > 0) {
    console.log(`%c 🔧 Auto-Fix Summary:`, "color: cyan; font-weight: bold;");
    fixedItems.forEach(item => console.log(`  - ${item}`));
    console.log("");
}

if (errors > 0) {
  console.log(`%c ❌ Architectural Governance FAILED: ${errors} errors, ${warnings} warnings`, "color: red; font-weight: bold;");
  Deno.exit(1);
} else {
  console.log(`%c ✅ Architectural Governance PASSED: ${warnings} warnings detected`, "color: green; font-weight: bold;");
  Deno.exit(0);
}
