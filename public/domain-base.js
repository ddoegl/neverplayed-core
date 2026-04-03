import { 
    PLEXUS_ENGINE_SERVICE, 
    SESSION_SERVICE
} from "core-types";
import { CoreActivator } from "./osgi-base.js";

/**
 * DomainActivator
 * Persona-aware activator for application domain logic.
 * Requires Layer 3+ services (Plexus, Session).
 */
export class DomainActivator extends CoreActivator {
    constructor() {
        super();
        this.plexus = null;
        this.session = null;
    }

    async onCoreStart(context) {
        // 1. Track Plexus
        context.trackService(`(objectClass=${PLEXUS_ENGINE_SERVICE})`, {
            addingService: (ref) => { this.plexus = context.getService(ref); },
            removedService: () => { this.plexus = null; }
        }).open();

        // 2. Track Session
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => { this.session = context.getService(ref); },
            removedService: () => { this.session = null; }
        }).open();

        await this.onDomainStart(context);
    }

    async onDomainStart(_context) {
        // To be implemented by subclasses
    }
}
