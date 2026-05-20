import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-nodejs@0.8.33";
import Pandino from "https://esm.sh/@pandino/pandino@0.8.33/denonext/pandino.mjs";
import { resolve, join } from "https://deno.land/std@0.221.0/path/mod.ts";
import { SHELL_CLI_SERVICE } from "core-types";

const BASE_URL = `file://${Deno.cwd()}/public/`;

// 1. Unified Happy-DOM Environment Setup
import { Window } from "https://esm.sh/happy-dom@13.3.8";
const domWindow = new Window();
const constructors = [
    'Node', 'Element', 'HTMLElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLButtonElement',
    'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLStyleElement',
    'CustomEvent', 'Event', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'CharacterData', 'DocumentFragment', 'NamedNodeMap', 'Text', 'Comment', 'Attr',
    'CustomElementRegistry'
];
const instances = [
    'window', 'document', 'navigator', 'location', 'history',
    'customElements', 'localStorage', 'sessionStorage'
];
// deno-lint-ignore no-explicit-any
const winAny = domWindow as any;
[...constructors, ...instances].forEach(key => {
    // deno-lint-ignore no-explicit-any
    if (winAny[key] && !(globalThis as any)[key]) {
        try {
            // deno-lint-ignore no-explicit-any
            (globalThis as any)[key] = winAny[key];
        } catch (_e) { /* ignore */ }
    }
});
// Fallback: Catch any other Passthrough constructors not in our list
Object.getOwnPropertyNames(winAny).forEach(key => {
    // deno-lint-ignore no-explicit-any
    if (key[0] === key[0].toUpperCase() && typeof winAny[key] === 'function' && !(globalThis as any)[key]) {
        try {
            // deno-lint-ignore no-explicit-any
            (globalThis as any)[key] = winAny[key];
        } catch (_err) { /* empty */ }
    }
});
// deno-lint-ignore no-explicit-any
(globalThis as any).window = globalThis;
// deno-lint-ignore no-explicit-any
(globalThis as any).document = domWindow.document;
// deno-lint-ignore no-explicit-any
(globalThis as any).navigator = domWindow.navigator;
// deno-lint-ignore no-explicit-any
(globalThis as any).NEVERPLAYED_BASE_URL = BASE_URL;
if (!(globalThis as any).location) {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).location = { href: 'http://localhost/', hostname: 'localhost' };
}



// 2. Mock Non-Admin User (initially)
const headlessUser = {
    email: "test-user@neverplayed.org",
    uid: "test-uid",
    isSuperuser: false,
    isDeveloper: false,
    authorized: true,
    attributes: {} as Record<string, unknown>
};
// deno-lint-ignore no-explicit-any
(globalThis as any).NEVERPLAYED_HEADLESS_USER = headlessUser;

// 3. Fetcher & Fetch Mock
const denoFetcher = async (urlOrString: string | URL) => {    
    const url = typeof urlOrString === 'string' ? urlOrString : urlOrString.toString();
    const path = url.replace(/^file:\/+/ , "/").split('?')[0];
    try {
        return await Deno.readTextFile(path);
    } catch (_err) {
        const altPath = resolve(Deno.cwd(), "public", path.replace(/^\//, ""));
        return await Deno.readTextFile(altPath);
    }
};

// deno-lint-ignore no-explicit-any
(globalThis as any).fetch = async (url: string | URL) => {
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
        "bundles/org.neverplayed.persistence-selector/manifest.json",
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/org.neverplayed.yaml-service/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.perceiver-service/manifest.json",
        "bundles/org.neverplayed.plexus-core/manifest.json",
        "bundles/org.neverplayed.plexus-enricher/manifest.json",
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

    const shellRef = context.getServiceReference(SHELL_CLI_SERVICE);
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
    const bundlesToRestart = ["org.neverplayed.auth-shield", "org.neverplayed.shell-cli"];
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
    const newShellRef = context.getServiceReference(SHELL_CLI_SERVICE);
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
