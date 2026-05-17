import Pandino from "https://esm.sh/@pandino/pandino@0.8.33";
import loaderConfiguration from "https://esm.sh/@pandino/loader-configuration-dom@0.8.33";

async function audit() {
    const pandino = new Pandino({ ...loaderConfiguration });
    await pandino.init();
    const context = pandino.getBundleContext();
    
    const refs = context.getServiceReferences(null, null);
    console.log("Total Services:", refs.length);
    
    refs.forEach(ref => {
        const objectClass = ref.getProperty("objectClass");
        const impl = ref.getProperty("implementation") || "unknown";
        const rank = ref.getProperty("service.ranking") || 0;
        console.log(`[SERVICE] ${objectClass} | Impl: ${impl} | Rank: ${rank}`);
    });
}

audit();
