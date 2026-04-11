import { DEPLOYMENT_ROOT_PROP, FRAMEWORK_LOGGER, FRAMEWORK_MANIFEST_FETCHER } from "npm:@pandino/pandino-api";
import type { BundleActivator, BundleContext, Logger, ManifestFetcher, ServiceReference } from "npm:@pandino/pandino-api";
import { DenoInstallerService } from "./installer-service.ts";

export default class Activator implements BundleActivator {
  private context?: BundleContext;
  private fetcherReference?: ServiceReference<ManifestFetcher>;
  private loggerReference?: ServiceReference<Logger>;
  private installerService?: DenoInstallerService;

  start(context: BundleContext): Promise<void> {
    this.context = context;

    // Retrieve standard Pandino services
    this.loggerReference = context.getServiceReference<Logger>(FRAMEWORK_LOGGER)!;
    const logger = context.getService<Logger>(this.loggerReference)!;

    this.fetcherReference = context.getServiceReference<ManifestFetcher>(FRAMEWORK_MANIFEST_FETCHER)!;
    const fetcher = context.getService<ManifestFetcher>(this.fetcherReference)!;

    // Initialize our Deno-specific installer service
    this.installerService = new DenoInstallerService(
      this.context.getProperty(DEPLOYMENT_ROOT_PROP),
      this.context,
      logger,
      fetcher
    );

    // Start watching the deployment directory
    this.installerService.watch();
    return Promise.resolve();
  }

  stop(context: BundleContext): Promise<void> {
    if (this.installerService) {
      this.installerService.stopWatch();
    }
    if (this.fetcherReference) {
      context.ungetService(this.fetcherReference);
    }
    if (this.loggerReference) {
      context.ungetService(this.loggerReference);
    }
    return Promise.resolve();
  }
}