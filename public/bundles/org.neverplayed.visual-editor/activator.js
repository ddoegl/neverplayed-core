import { ATOMIC_COMPONENT_REGISTRY_SERVICE } from "core-types";
import { BaseActivator } from "osgi-base";
import "./components/atomic-visual-editor.js";

export default class Activator extends BaseActivator {
    onStart(context) {
        const logger = this.logger;
        logger.info("Visual DO Editor: Activator starting...");
        
        // 1. Register Component Registry Entry
        context.trackService(`(objectClass=${ATOMIC_COMPONENT_REGISTRY_SERVICE})`, {
            addingService: (ref) => {
                const registry = context.getService(ref);
                registry.register('visual-editor', 'atomic-visual-editor');
                logger.debug("Visual DO Editor: Registered 'visual-editor' component strategy.");
            }
        }).open();

        // 2. Inject Host Bridge Method (Phase 7)
        const injectBridge = () => {
            const host = globalThis.backofficeState || globalThis.businessPortalState;
            if (host) {
                host.editDomainObjectVisual = (id) => {
                    logger.info(`Visual DO Editor: Launching editor for ${id}`);
                    if (host.loadStep) {
                        host.loadStep('visual-do-editor', { blueprintId: id });
                    } else {
                        globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { 
                            detail: { id: 'visual-do-editor', params: { blueprintId: id } } 
                        }));
                    }
                };
                if (host.recompile) host.recompile();
            } else {
                setTimeout(injectBridge, 500);
            }
        };
        injectBridge();

        logger.info("Visual DO Editor: Bundle active. 🎨✅");
    }

    stop() {
        this.logger.info("Visual DO Editor: Bundle stopped");
    }
}