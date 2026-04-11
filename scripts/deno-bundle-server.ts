import Pandino from 'npm:@pandino/pandino';
import loaderConfiguration from './deno-loader-configuration.ts';
import { dirname, fromFileUrl, join, normalize } from "https://deno.land/std@0.224.0/path/mod.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

// 1. Setup paths
const __dirname = dirname(fromFileUrl(import.meta.url));
// The bundles are located in the public/bundles directory relative to the project root
const DEPLOYMENT_ROOT = normalize(join(__dirname, '..', 'public', 'bundles'));
const PORT = 3000;

console.log(`[Server] Deployment Root: ${DEPLOYMENT_ROOT}`);

// 2. Initialize Pandino
const pandino = new Pandino({
    ...loaderConfiguration,
    'pandino.deployment.root': DEPLOYMENT_ROOT,
});

await pandino.init();
await pandino.start();

console.log('[Pandino] Engine started successfully');

// 3. Install a baseline bundle to verify the environment
const context = pandino.getBundleContext();
try {
    // We attempt to install the system logger as a smoke test
    await context.installBundle("./org.neverplayed.deno-bundle-installer/manifest.json");
    console.log('[Pandino] Baseline bundle (deno-bundle-installer) installed');
} catch (e: unknown) {
    console.warn(`[Pandino] Baseline bundle installation skipped or failed: ${(e as Error).message}`);
}

// 4. Start the Deno native server
console.log(`[Server] Listening on http://localhost:${PORT}`);

Deno.serve({ port: PORT }, (req) => {
    const url = new URL(req.url);
    
    // Serve static files from the bundles directory for clients
    // Example: http://localhost:3000/bundles/org.neverplayed.system-logger/manifest.json
    if (url.pathname.startsWith('/bundles/')) {
        return serveDir(req, {
            fsRoot: DEPLOYMENT_ROOT,
            urlRoot: "bundles",
            quiet: true,
        });
    }

    // Health check or info page
    return new Response(JSON.stringify({
        status: "running",
        engine: "Pandino",
        bundles: context.getBundles().map(b => ({
            id: b.getBundleId(),
            symbolicName: b.getSymbolicName(),
            state: b.getState(),
        })),
    }, null, 2), { 
        status: 200,
        headers: { "content-type": "application/json" }
    });
});
