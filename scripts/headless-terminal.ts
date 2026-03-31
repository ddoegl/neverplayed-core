import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33";
import Pandino from "https://esm.sh/@pandino/pandino@0.8.33/denonext/pandino.mjs";
import { join, resolve } from "https://deno.land/std@0.221.0/path/mod.ts";
import { parseArgs } from "https://deno.land/std@0.221.0/cli/parse_args.ts";
import process from "node:process";

/**
 * Universal Terminal Bootloader 🌌📺
 * Standard OSGi Lifecycle Strategy [Production Grade]
 */

const args = parseArgs(Deno.args);
const MODE = args.url ? "WEB" : "FS";
const REMOTE_URL = args.url;
const BASE_URL = REMOTE_URL || `file://${Deno.cwd()}/public/`;

// 1. Unified Environment Mocks
const mockDoc = {
    createElement: () => ({ style: {}, appendChild: () => {}, addEventListener: () => {}, setAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
};

// deno-lint-ignore no-explicit-any
(globalThis as any).document = mockDoc as any;
// deno-lint-ignore no-explicit-any
(globalThis as any).window = globalThis as any;
// deno-lint-ignore no-explicit-any
(globalThis as any).NEVERPLAYED_BASE_URL = BASE_URL;

// 3. Headless Security Context
const terminalUser = Deno.env.get("NEVERPLAYED_USER") || "terminal-admin@neverplayed.org";
// deno-lint-ignore no-explicit-any
(globalThis as any).NEVERPLAYED_HEADLESS_USER = {
    email: terminalUser,
    uid: "terminal-system-uid",
    isSuperuser: true,
    isDeveloper: true,
    authorized: true
};

// 4. Fetcher for Pandino
const denoFetcher = async (url: string) => {    
    const isHttp = url.startsWith("http");
    if (isHttp) return await fetch(url).then(r => r.text());
    
    // Local FS: Standardize path
    const path = url.replace(/^file:\/+/ , "/").split('?')[0];
    try {
        return await Deno.readTextFile(path);
    } catch (_err) {
        const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
        return await Deno.readTextFile(altPath);
    }
};

// 5. Main Execution
async function main() {
    process.stdout.write(`\x1b[35m\x1b[1m\x1b[4m🌌 Never Played: Terminal Edition [Mode: ${MODE}] 🌌\x1b[0m\n\n`);

    const pandino = new Pandino({
        ...loaderConfiguration,
        "pandino.loader.fetcher": denoFetcher,
        "pandino.base.url": BASE_URL,
    // deno-lint-ignore no-explicit-any
    } as any);

    await pandino.init();
    await pandino.start();
    const context = pandino.getBundleContext();

    let isFirebase = false;
    try {
        const envPath = join(Deno.cwd(), "public", "env.json");
        const envConfig = JSON.parse(await Deno.readTextFile(envPath));
        isFirebase = envConfig.persistence_mode === "firebase";
    } catch (_e) {
        // Fallback to local
    }

    const coreManifests = [
        isFirebase ? "bundles/org.neverplayed.persistence-firebase/manifest.json" : "bundles/org.neverplayed.persistence-deno/manifest.json",
        "bundles/org.neverplayed.persistence-selector/manifest.json",
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/org.neverplayed.auth-shield/manifest.json",
        "bundles/org.neverplayed.limes/manifest.json",
        "bundles/org.neverplayed.config-admin/manifest.json",
        "bundles/org.neverplayed.system-reset/manifest.json",
        "bundles/org.neverplayed.shell-cli/manifest.json",
        "bundles/org.neverplayed.shell-cli-term/manifest.json", 
    ];

    process.stdout.write(`📡 [${MODE}] Deploying Core Systems...\n`);

    for (const path of coreManifests) {
        const url = `${BASE_URL}${path}`;
        try {
            const absPath = url.replace(/^file:\/+/ , "/");
            const manifestText = await Deno.readTextFile(absPath);
            const manifest = JSON.parse(manifestText);
            const dirPath = absPath.substring(0, absPath.lastIndexOf("/"));
            if (manifest["Bundle-Activator"]) {
                manifest["Bundle-Activator"] = join(dirPath, manifest["Bundle-Activator"].replace(/^\.\//, ""));
            }
            const bundle = await context.installBundle(manifest);
            if (bundle && (bundle.getState() as unknown as number) < 32) {
                await bundle.start();
            }
        // deno-lint-ignore no-explicit-any
        } catch (err: any) {
            console.error(`❌ [${MODE}] Failed to boot ${path}:`, err.message);
        }
    }

    let activeBundles = [];
    for (let i = 0; i < 20; i++) {
        // deno-lint-ignore no-explicit-any
        activeBundles = context.getBundles().filter((b: any) => {
            const s = Number(typeof b.getState === 'function' ? b.getState() : b.state);
            return s >= 32;
        });
        if (activeBundles.length >= coreManifests.length) break;
        await new Promise(r => setTimeout(r, 100));
    }

    process.stdout.write(`\x1b[32m✅ Universe Initialized. ${activeBundles.length} Bundles Active.\x1b[0m\n`);
    process.stdout.write(`Interactive Shell managed by @neverplayed/shell-cli-term\n\n`);

    // Prevent process exit
    setInterval(() => {}, 1000);
}

main().catch(err => {
    console.error("CATASTROPHE:", err.message);
    Deno.exit(1);
});
