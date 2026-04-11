// Deno supports node: imports, but we can also use Deno's native APIs
import { join, normalize, dirname, toFileUrl, isAbsolute } from "https://deno.land/std@0.224.0/path/mod.ts";
import { PANDINO_BUNDLE_IMPORTER_PROP, PANDINO_MANIFEST_FETCHER_PROP } from "npm:@pandino/pandino-api";
import type { BundleImporter, ManifestFetcher } from "npm:@pandino/pandino-api";

export interface LoaderConfig {
  [PANDINO_MANIFEST_FETCHER_PROP]: ManifestFetcher;
  [PANDINO_BUNDLE_IMPORTER_PROP]: BundleImporter;
}

const loaderConfig: LoaderConfig = {
  [PANDINO_MANIFEST_FETCHER_PROP]: {
    fetch: async (uri: string, deploymentRoot?: string) => {
      console.log('uri', uri);
      console.log('deploymentRoot', deploymentRoot);
      
      // Use Deno.readTextFile for a more "Deno" approach
      // Robust path resolution: check if uri is absolute
      const fullPath = isAbsolute(uri) ? normalize(uri) : normalize(join(deploymentRoot ?? "", uri));
      const data = await Deno.readTextFile(fullPath);
      return JSON.parse(data);
    },
  },
  [PANDINO_BUNDLE_IMPORTER_PROP]: {
    import: (activatorLocation: string, manifestLocation: string, deploymentRoot?: string) => {
      const manifestPath = isAbsolute(manifestLocation) 
        ? normalize(manifestLocation) 
        : normalize(join(deploymentRoot ?? "", manifestLocation));
      const root = dirname(manifestPath);
      const fullPath = normalize(join(root, activatorLocation));
      
      console.log('activatorLocation', activatorLocation);
      console.log('manifestLocation', manifestLocation);
      console.log('deploymentRoot', deploymentRoot);
      console.log('fullPath', fullPath);
      
      return import(toFileUrl(fullPath).href);
    },
  },
};

export default loaderConfig;