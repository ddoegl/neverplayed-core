import { 
    FLOW_SERVICE,
    REALM_MANAGER_SERVICE,
    PLATFORM_SHOWCASE_FLOW
} from "core-types";
import { CoreAlpineActivator } from "alpine-base";

/**
 * Platform Showcase Activator
 * Demonstrates Gold Standard Pattern 7: Reactive Flow Management.
 */
export default class Activator extends CoreAlpineActivator {
    constructor() {
        super();
        this._realmManager = null;
    }

    onCoreStart(context) {
        // 1. Track Realm Manager for "Space-Time" demos
        this.track(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._realmManager = context.getService(ref);
                return this._realmManager;
            },
            removedService: () => { this._realmManager = null; }
        });

        // 2. Register as a Flow
        context.registerService(FLOW_SERVICE, this, {
            "flow.id": PLATFORM_SHOWCASE_FLOW,
            "flow.title": "Showcase Lab",
            "icon": "fas fa-flask",
            "sidebar": true
        });
    }

    /**
     * Protocol: launch (Pattern 7)
     * Standard entry point for Flow Services.
     */
    async launch(options = {}) {
        this.logger.info("Platform Showcase: Launch triggered.");
        return this.onActivate(options);
    }

    /**
     * onActivate (Pattern 7)
     * Resumes the UI state when this flow becomes active in the stage.
     */
    async onActivate(_stageState) {
        this.logger.info("Platform Showcase: Materializing Stage...");
        const self = this;

        await this.render('#flow-active-stage', 'templates/showcase.html', () => {
            const shell = Alpine.store('shell_context');

            return {
                get activeRealm() { return shell.activeRealm || { id: 'unknown' }; },
                get realms() { return shell.realms || []; },

                async switchTo(id) {
                    if (self._realmManager) {
                        try {
                            self.logger.info(`Showcase: Universe transition triggered: ${id}`);
                            const result = await self._realmManager.switchRealm(id);
                            self.logger.debug(`Showcase: Transition result:`, result);
                        } catch (err) {
                            self.logger.error(`Showcase: Transition failed:`, err.message);
                        }
                    }
                }
            };
        });
    }
}
