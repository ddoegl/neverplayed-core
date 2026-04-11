/**
 * Activator for org.neverplayed.agent.antigravity
 */
import { 
    CoreActivator 
} from "osgi-base";
import { 
    AGENT_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE
} from "core-types";
import { AgentService } from "./agent-service.js";

export default class Activator extends CoreActivator {
    onCoreStart() {
        this.logger.info("[Antigravity Agent] Activator starting...");
        
        // Track persistence for audit logs
        this.context.trackService(`(objectClass=${PERSISTENCE_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                const pm = this.context.getService(ref);
                this.initializeAgent(pm);
                return pm;
            },
            removedService: () => {
                this.stopAgent();
            }
        }).open();

        // Optional: Track EventAdmin & Factory for telemetry shouts
        this.context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                if (this.agent) {
                    this.agent.eventAdmin = this.context.getService(ref);
                }
                return this.context.getService(ref);
            }
        }).open();

        this.context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => {
                if (this.agent) {
                    this.agent.eventFactory = this.context.getService(ref);
                }
                return this.context.getService(ref);
            }
        }).open();
    }

    initializeAgent(pm) {
        if (this.agent) return;

        this.agent = new AgentService(this.context, this.logger, pm);
        
        // Register the service
        this.registration = this.context.registerService(AGENT_SERVICE, this.agent);
        this.logger.info("[Antigravity Agent] Service registered successfully. 🛰️✅");

        // Schedule periodic audit (Every 5 minutes = 300,000ms)
        this.auditInterval = setInterval(() => {
            this.agent.audit();
            this.agent.recover(); // Autonomous recovery enabled
        }, 300000);

        // Immediate first run
        setTimeout(() => {
            this.agent.audit();
            this.agent.recover();
        }, 1000);
    }

    stopAgent() {
        if (this.auditInterval) {
            clearInterval(this.auditInterval);
        }
        if (this.registration) {
            this.registration.unregister();
            this.registration = null;
        }
        this.agent = null;
    }

    onCoreStop() {
        this.stopAgent();
        this.logger.info("[Antigravity Agent] Resident departed. 🛰️👋");
    }
}
