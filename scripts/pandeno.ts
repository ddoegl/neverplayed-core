// 1. Import your custom Deno loader configuration we created earlier
import loaderConfiguration from './deno-loader-configuration.ts';

// 2. Import Pandino directly from NPM
import Pandino from 'npm:@pandino/pandino';

// 3. Define your deployment root (Deno uses standard absolute paths)
const MY_DEPLOY_ROOT = Deno.cwd() + '/public/bundles';
console.log(MY_DEPLOY_ROOT);

// 4. Initialize Pandino
const pandino = new Pandino({
    ...loaderConfiguration,
    'pandino.deployment.root': MY_DEPLOY_ROOT,
});

// 5. Deno supports top-level await natively
await pandino.init();
await pandino.start();

console.log('Pandino has started successfully in Deno!');
const context = pandino.getBundleContext();
await context.installBundle("./org.neverplayed.system-logger/manifest.json");
const bundles = context.getBundles();

console.log(`\nTotal bundles loaded: ${bundles.length}`);