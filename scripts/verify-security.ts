import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33";
import Pandino from "https://esm.sh/@pandino/pandino@0.8.33/denonext/pandino.mjs";
import { resolve, join } from "https://deno.land/std@0.221.0/path/mod.ts";

const BASE_URL = `file://${Deno.cwd()}/public/`;

// 1. Unified Environment Mocks
const mockDoc = {
    createElement: () => ({ style: {}, appendChild: () => {}, addEventListener: () => {}, setAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
};

// Using type assertions to satisfy the linter while keeping mocks simple
(globalThis as unknown as Record<string, unknown>).document = mockDoc;
(globalThis as unknown as Record<string, unknown>).window = globalThis;
(globalThis as unknown as Record<string, unknown>).NEVERPLAYED_BASE_URL = BASE_URL;

// 2. Mock Non-Admin User (initially)
const headlessUser = {
    email: "test-user@neverplayed.org",
    uid: "test-uid",
    isSuperuser: false,
    isDeveloper: false,
    authorized: true,
    attributes: {} as Record<string, unknown>
};
(globalThis as unknown as Record<string, unknown>).NEVERPLAYED_HEADLESS_USER = headlessUser;

// 3. Fetcher & Fetch Mock
const denoFetcher = async (url: string) => {    
    const path = url.replace(/^file:\/+/ , "/").split('?')[0];
    try {
        return await Deno.readTextFile(path);
    } catch (_err) {
        const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
        return await Deno.readTextFile(altPath);
    }
};

(globalThis as unknown as Record<string, unknown>).fetch = async (url: string) => {
    const text = await denoFetcher(url);
    return {
        text: () => Promise.resolve(text),
        json: () => Promise.resolve(JSON.parse(text)),
        ok: true
    };
};

async function main() {
    const pandino = new Pandino({
        ...loaderConfiguration,
        "pandino.loader.fetcher": denoFetcher,
        "pandino.base.url": BASE_URL,
    // deno-lint-ignore no-explicit-any
    } as any);

    await pandino.init();
    await pandino.start();
    const context = pandino.getBundleContext();

    const coreManifests = [
        "bundles/org.neverplayed.persistence-deno/manifest.json",
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/system-services/yaml-service/manifest.json",
        "bundles/org.neverplayed.auth-shield/manifest.json",
        "bundles/org.neverplayed.limes/manifest.json",
        "bundles/org.neverplayed.config-admin/manifest.json",
        "bundles/org.neverplayed.shell-cli/manifest.json",
    ];

    for (const path of coreManifests) {
        const url = `${BASE_URL}${path}`;
        const absPath = url.replace(/^file:\/+/ , "/");
        const manifestText = await Deno.readTextFile(absPath);
        const manifest = JSON.parse(manifestText);
        const dirPath = absPath.substring(0, absPath.lastIndexOf("/"));
        if (manifest["Bundle-Activator"]) {
            manifest["Bundle-Activator"] = join(dirPath, manifest["Bundle-Activator"].replace(/^\.\//, ""));
        }
        // deno-lint-ignore no-explicit-any
        const bundle = await context.installBundle(manifest) as any;
        if (Number(bundle.getState()) === 2) { // INSTALLED
            await bundle.start();
        }
    }

    // Wait for services to register and CoreActivators to settle
    console.log("Waiting for services to settle...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("Audit: Installed Bundles:");
    context.getBundles().forEach(b => {
        console.log(` - ${b.getSymbolicName()} (State: ${b.getState()})`);
    });

    const allRefs = context.getServiceReferences(undefined, undefined) || [];
    console.log(`Discovered ${allRefs.length} service references.`);
    allRefs.forEach(ref => {
        const classes = ref.getProperty("objectClass");
        console.log(` - Service: ${classes} (Bundle: ${ref.getBundle()?.getSymbolicName()})`);
    });

    const shellRef = context.getServiceReference("@neverplayed/shell-cli/service");
    if (!shellRef) {
        console.error("Shell service not found! Available services:");
        allRefs.forEach(ref => console.log(" -", ref.getProperty("objectClass")));
        Deno.exit(1);
    }
    // deno-lint-ignore no-explicit-any
    const shell = context.getService(shellRef) as any;

    console.log("--- STARTING SECURITY VERIFICATION ---");
    
    // Test Case 1: Non-Admin Blocked
    console.log("Test Case 1: Attempting administrative command as non-admin...");
    await shell.execute("/install some-bundle");
    let history = shell.getHistory();
    let lastEntry = history[history.length - 1];
    console.log("Result:", lastEntry.content);
    
    if (!lastEntry.content.includes("Access Denied")) {
        console.log("❌ TEST 1 FAILED: Access was NOT denied for non-admin.");
        Deno.exit(1);
    }
    console.log("✅ TEST 1 PASSED: Access denied as expected.");

    // Test Case 2: Superuser Granted
    console.log("\nTest Case 2: Promoting user to Superuser and retrying...");
    headlessUser.isSuperuser = true;
    headlessUser.attributes = { 'neverplayed-admin': true };
    
    // Restart bundles to pick up new global state
    const bundlesToRestart = ["@neverplayed/auth-shield", "@neverplayed/shell-cli"];
    for (const bsn of bundlesToRestart) {
        // deno-lint-ignore no-explicit-any
        const bundle = context.getBundles().find((b: any) => b.getSymbolicName() === bsn);
        if (bundle) {
            console.log(`Restarting ${bsn} bundle...`);
            await bundle.stop();
            await bundle.start();
        }
    }

    // Wait for services to re-settle
    await new Promise(r => setTimeout(r, 2000));

    // Re-acquire shell service
    const newShellRef = context.getServiceReference("@neverplayed/shell-cli/service");
    if (!newShellRef) {
        console.error("Shell service not found after restart!");
        Deno.exit(1);
    }
    // deno-lint-ignore no-explicit-any
    const newShell = context.getService(newShellRef) as any;

    await newShell.execute("/install some-other-bundle");
    history = newShell.getHistory();
    lastEntry = history[history.length - 1];
    console.log("Result:", lastEntry.content);

    if (lastEntry.content.includes("Access Denied")) {
        console.log("❌ TEST 2 FAILED: Access was DENIED for superuser.");
        Deno.exit(1);
    }
    console.log("✅ TEST 2 PASSED: Access granted as expected.");

    console.log("\n✨ ALL SECURITY VERIFICATIONS PASSED! ✨");
    Deno.exit(0);
}

main();
