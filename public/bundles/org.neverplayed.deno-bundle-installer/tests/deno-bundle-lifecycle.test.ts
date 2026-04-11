import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import Pandino from "npm:@pandino/pandino";
import loaderConfiguration from "../../../../scripts/deno-loader-configuration.ts";

const MY_DEPLOY_ROOT = Deno.cwd() + "/public/bundles";
console.log(MY_DEPLOY_ROOT);

Deno.test({
  name: "Pandino Bundle Lifecycle Test",
  sanitizeResources: false, // Required if bundles leave handles open (like servers)
  sanitizeOps: false,
  async fn() {
    // 1. Setup Pandino with our Deno loader
    const pandino = new Pandino({
      ...loaderConfiguration,
      "pandino.deployment.root": MY_DEPLOY_ROOT,
    });

    // 2. Initialize and Start
    await pandino.init();
    await pandino.start();

    

    // 3. Get the Bundle Context to inspect loaded bundles
    const context = pandino.getBundleContext();
    await context.installBundle("./org.neverplayed.deno-bundle-installer/manifest.json");
    const bundles = context.getBundles();

    console.log(`\nTotal bundles loaded: ${bundles.length}`);

    // 4. Verification Logic
    for (const bundle of bundles) {
      console.log(`Checking Bundle: ${bundle.getSymbolicName()} [${bundle.getVersion()}]`);
      
      // State 32 is 'ACTIVE' in OSGi/Pandino terms
      // You can also use Bundle.ACTIVE if you import the constants
      assertEquals(bundle.getState(), 'ACTIVE', `Bundle ${bundle.getSymbolicName()} should be ACTIVE`);
    }

    // 5. Cleanup (Optional: Stop Pandino after tests)
    await pandino.stop();
  },
});