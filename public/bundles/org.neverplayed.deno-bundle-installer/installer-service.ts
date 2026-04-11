import { relative } from "https://deno.land/std@0.224.0/path/mod.ts";
import type { BundleContext, Logger, ManifestFetcher } from "npm:@pandino/pandino-api";

export class DenoInstallerService {
  private abortController: AbortController = new AbortController();

  constructor(
    private deploymentRoot: string,
    private context: BundleContext,
    private logger: Logger,
    private fetcher: ManifestFetcher
  ) {}

  async watch() {
    this.logger.info(`Deno Installer watching: ${this.deploymentRoot}`);
    
    // Deno uses an async iterable for file watching
    const watcher = Deno.watchFs(this.deploymentRoot);
    
    try {
      for await (const event of watcher) {
        // If stopped, the loop will break via the abort signal if we used one,
        // but simple break works for this pattern.
        if (this.abortController.signal.aborted) break;

        if (event.kind === "create" || event.kind === "modify") {
          for (const path of event.paths) {
            if (path.endsWith("manifest.json")) {
              this.logger.info(`New bundle detected at ${path}`);
              const relativePath = relative(this.deploymentRoot, path);
              await this.handleInstall(relativePath);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.Http) { /* ignore */ }
      else this.logger.error("Watcher error", err);
    }
  }

  private async handleInstall(manifestPath: string) {
    try {
      // In Deno, we use the fetcher service we got from the framework
      //const manifest = await this.fetcher.fetch(manifestPath);
      // Logic to tell Pandino to install/update the bundle
      console.log("manifestPath", manifestPath);
      await this.context.installBundle(manifestPath);
    } catch (e) {
      this.logger.error(`Failed to install bundle from ${manifestPath}`, e);
    }
  }

  stopWatch() {
    this.abortController.abort();
  }
}