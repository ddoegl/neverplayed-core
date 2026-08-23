/**
 * Core Infrastructure Extraction Script (ADR-0035)
 * 
 * Implements the Clone-and-Prune strategy:
 * 1. Clones the current repository into ../neverplayed-core (preserving 100% commit history).
 * 2. Promotes public/realms-secure.html -> public/index.html.
 * 3. Prunes domain/realm bundles and legacy HTML harnesses.
 * 4. Verifies test pass in the new standalone workspace.
 */

import { exists } from "https://deno.land/std@0.207.0/fs/exists.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

const currentDir = Deno.cwd();
const targetDir = path.resolve(currentDir, "../neverplayed-core");

console.log("=================================================");
console.log("🏛️  Never Played - Core Infrastructure Extraction");
console.log("=================================================");
console.log(`Source Workspace: ${currentDir}`);
console.log(`Target Workspace: ${targetDir}\n`);

if (await exists(targetDir)) {
  console.error(`❌ Target directory already exists: ${targetDir}`);
  console.error("Please remove or rename it before running the extraction script.");
  Deno.exit(1);
}

// 1. Clone to target directory
console.log("📦 1. Cloning repository to target directory...");
const cloneProcess = new Deno.Command("git", {
  args: ["clone", currentDir, targetDir],
}).spawn();

const cloneStatus = await cloneProcess.status;
if (!cloneStatus.success) {
  console.error("❌ Git clone failed.");
  Deno.exit(1);
}
console.log("✅ Git clone complete (Full history preserved).\n");

// 2. Transform public/realms-secure.html -> public/index.html
console.log("🔄 2. Promoting realms-secure.html to universal index.html...");
const realmsSecurePath = path.join(targetDir, "public/realms-secure.html");
const indexPath = path.join(targetDir, "public/index.html");

if (await exists(realmsSecurePath)) {
  await Deno.copyFile(realmsSecurePath, indexPath);
  await Deno.remove(realmsSecurePath);
  console.log("✅ public/realms-secure.html -> public/index.html promoted.");
}

// Remove legacy HTML files
const legacyHtmlFiles = [
  "public/barebones.html",
  "public/barebones-secure.html",
  "public/mini.html",
];
for (const file of legacyHtmlFiles) {
  const filePath = path.join(targetDir, file);
  if (await exists(filePath)) {
    await Deno.remove(filePath);
    console.log(`🗑️ Removed legacy harness: ${file}`);
  }
}

// 3. Prune Domain / Realm Bundles from neverplayed-core
console.log("\n🧹 3. Pruning domain and realm bundles from neverplayed-core...");
const domainBundles = [
  "public/bundles/flows",
  "public/bundles/org.neverplayed.realm.real-life",
  "public/bundles/org.neverplayed.realm.habitat",
  "public/bundles/org.neverplayed.realm.gym",
  "public/bundles/org.neverplayed.realm.somatic-body",
  "public/bundles/user-clients",
  "public/bundles/user-services",
  "public/bundles/system-clients",
  "public/bundles/system-services",
  "public/bundles/org.neverplayed.visual-editor",
  "public/bundles/org.neverplayed.atomic.showcase",
  "public/bundles/org.neverplayed.llm.gemma-showcase",
];

for (const bundleDir of domainBundles) {
  const fullPath = path.join(targetDir, bundleDir);
  if (await exists(fullPath)) {
    await Deno.remove(fullPath, { recursive: true });
    console.log(`✂️ Pruned domain bundle: ${bundleDir}`);
  }
}

// 4. Verification in target workspace
console.log("\n🧪 4. Running test suite in new neverplayed-core workspace...");
const testProcess = new Deno.Command("deno", {
  args: ["task", "test"],
  cwd: targetDir,
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

const testStatus = await testProcess.status;
if (!testStatus.success) {
  console.error("❌ Tests failed in extracted workspace.");
  Deno.exit(1);
}

console.log("\n=================================================");
console.log("🎉 Core Infrastructure Extraction SUCCESSFUL!");
console.log("=================================================");
console.log(`Location: ${targetDir}`);
console.log("To run the core server:\n");
console.log(`  cd ${targetDir}`);
console.log("  deno task start\n");
