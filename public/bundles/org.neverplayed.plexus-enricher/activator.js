import { 
    PLEXUS_ENRICHER_SERVICE,
    LOG_SERVICE 
} from "core-types";

export default class Activator {
    start(context) {
        this.logger = console;

        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this.logger = logAdmin.getLogger("plexus-enricher");
            }
        }).open();

        const service = {
            /**
             * Enrich a context or evaluate a complex matcher.
             * Focuses on the 'LEGALREP' and 'managing-partner' business rules.
             */
            matchRole: (block, context, config) => {
                const active = context.activeBusinessFunction || [];
                const roles = Array.isArray(active) ? active : [active];
                const authorities = context.userAuthorities || {};
                const matches = [];
                
                const roleId = block.value; 
                if (!roleId) return false;

                const searchIds = [roleId];
                if (roleId.endsWith('S')) searchIds.push(roleId.slice(0, -1));
                else searchIds.push(roleId + 'S');
                
                Object.keys(authorities).forEach(authKey => {
                    searchIds.forEach(sid => {
                        if (authKey === sid || authKey.startsWith(`${sid} (`) || authKey.startsWith(`${sid}-`)) {
                            let val = authorities[authKey];
                            if (val === context.userId) val = true;
                            if (val) matches.push(val);
                        }
                    });
                });

                if (matches.length === 0) {
                    if (roles.some(r => searchIds.includes(r))) {
                        matches.push(true);
                    }
                }
                
                if (matches.length === 0 && searchIds.includes('ADMINISTRATOR') && context.administrator === true) {
                    matches.push(true);
                }

                return matches.length > 0 ? matches : false;
            }
        };

        context.registerService(PLEXUS_ENRICHER_SERVICE, service);
        this.logger.info("Plexus Enricher Service: Activated.");
    }

    stop() {}
}
