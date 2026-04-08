/**
 * @file Activator for org.neverplayed.atomic.showcase
 * @module platform/bundles/org.neverplayed.atomic.showcase
 */

import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    onStart(_context) {
        const logger = this.logger;
        logger.info("Atomic Showcase: Activator starting...");

        // 1. Inject Host Bridge Methods (Phase 7)
        const injectBridge = () => {
            const host = globalThis.backofficeState || globalThis.businessPortalState;
            if (host) {

                // Strategies Editor Bridge
                host.openDOStrategiesEditor = () => {
                    logger.info("Atomic Showcase: Launching Strategies Editor");
                    if (host.loadStep) {
                        host.loadStep('atomic-showcase', { mode: 'STRATEGIES' });
                    } else {
                        globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { 
                            detail: { id: 'atomic-showcase', params: { mode: 'STRATEGIES' } } 
                        }));
                    }
                };

                if (host.recompile) host.recompile();
            } else {
                setTimeout(injectBridge, 500);
            }
        };
        injectBridge();

        logger.info("Atomic Showcase: Bundle active. 🎭✅");
    }

    stop() {
        this.logger.info("Atomic Showcase: Bundle stopped");
    }
}
