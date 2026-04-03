import { 
    FLOW_SERVICE,
    REALM_MANAGER_SERVICE
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
            "flow.id": "platform-showcase",
            "flow.title": "Showcase Lab",
            "icon": "fas fa-flask",
            "sidebar": true
        });
    }

    /**
     * onActivate (Pattern 7)
     * Resumes the UI state when this flow becomes active in the stage.
     */
    async onActivate(_stageState) {
        this.logger.info("Platform Showcase: Activated in Realm Stage.");
        
        await this.render('#flow-active-stage', 'templates/showcase.html', () => {
            const shell = Alpine.store('shell_context');

            return {
                get activeRealm() { return shell.activeRealm; },
                get realms() { return shell.realms; },

                async switchTo(id) {
                    if (this._realmManager) {
                        try {
                            const result = await this._realmManager.switchRealm(id);
                            this.logger.info(`Showcase: Universe transition triggered: ${id}`, result);
                        } catch (err) {
                            this.logger.error(`Showcase: Transition failed:`, err.message);
                        }
                    }
                }
            };
        });
    }
}
