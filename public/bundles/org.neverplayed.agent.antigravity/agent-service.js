/**
 * Antigravity Agent Service
 * 
 * Provides system health monitoring, architectural auditing, 
 * and autonomous recovery for the Never Played ecosystem.
 */
export class AgentService {
    constructor(context, logger, pm) {
        this.context = context;
        this.logger = logger;
        this.pm = pm;
        this.auditHistory = [];
        this.STORAGE_KEY = "realm.agent.antigravity_audit_log";
        this.initStore();
    }

    /**
     * Initialize the reactive Alpine store if running in a browser
     */
    initStore() {
        if (typeof globalThis.Alpine !== "undefined") {
            this.store = globalThis.Alpine.store("antigravity_agent", {
                active: true,
                healthy: true,
                findingsCount: 0,
                lastAudit: Date.now(),
                mode: "Overseer"
            });
        }
    }

    /**
     * Synchronize local state with the Alpine store
     */
    syncInternal(data) {
        if (this.store) {
            Object.assign(this.store, data);
        }
    }

    /**
     * Get basic system telemetry
     */
    status() {
        const bundles = this.context.getBundles();
        // Handle both numeric 32 and string 'ACTIVE' depending on environment
        const active = bundles.filter(b => b.getState() === 32 || b.getState() === 'ACTIVE').length;
        const total = bundles.length;

        const report = {
            timestamp: Date.now(),
            bundleMetrics: {
                active,
                installed: total - active,
                total
            },
            healthy: active === total
        };

        this.syncInternal(report);
        return report;
    }

    /**
     * Perform an architectural audit of the current system
     */
    audit() {
        this.logger.info("[Antigravity Agent] Starting architectural audit...");
        const findings = [];
        const bundles = this.context.getBundles();

        bundles.forEach(b => {
            const state = b.getState();
            const bsn = b.getSymbolicName();

            // Check for non-active bundles
            if (state !== 32 && state !== 'ACTIVE') {
                findings.push({
                    type: "STATE_WARNING",
                    bsn,
                    message: `Bundle is in state [${state}], expected ACTIVE (32).`,
                    severity: "high"
                });
            }

            // Architecture Pattern Check: Manifest Headers
            const headers = b.getHeaders();
            if (!headers["Bundle-SymbolicName"]) {
                findings.push({
                    type: "MANIFEST_VIOLATION",
                    bsn,
                    message: "Bundle is missing required Bundle-SymbolicName header.",
                    severity: "critical"
                });
            }
        });

        const report = {
            id: `audit-${Date.now()}`,
            timestamp: Date.now(),
            findings,
            summary: `${findings.length} findings recorded.`
        };

        this.syncInternal({
            findingsCount: findings.length,
            healthy: findings.length === 0,
            lastAudit: Date.now()
        });

        // Trigger Forensic Bridge sync
        this.shout("org/neverplayed/agent/AUDIT_COMPLETED", {
            findingsCount: findings.length,
            healthy: findings.length === 0,
            timestamp: Date.now()
        });
        
        this.recordAudit(report);
        this.logger.info(`[Antigravity Agent] Audit complete. ${findings.length} findings.`);
        return report;
    }

    /**
     * Autonomous Recovery Logic
     */
    recover() {
        this.logger.info("[Antigravity Agent] Initiating autonomous recovery cycle...");
        const bundles = this.context.getBundles();
        let restarted = 0;

        bundles.forEach(b => {
            if (b.getState() === 2 || b.getState() === 4) { // INSTALLED or RESOLVED
                try {
                    this.logger.info(`[Antigravity Agent] Attempting to start bundle: ${b.getSymbolicName()}`);
                    b.start();
                    restarted++;
                } catch (e) {
                    this.logger.error(`[Antigravity Agent] Recovery failed for ${b.getSymbolicName()}: ${e.message}`);
                }
            }
        });

        if (restarted > 0) {
            this.shout("org/neverplayed/agent/RECOVERY_EXECUTED", { restarted });
        }
        return restarted;
    }

    /**
     * Broadcast telemetry to the EventAdmin
     */
    shout(topic, data) {
        if (this.eventAdmin && this.eventFactory) {
            try {
                const event = this.eventFactory.build(topic, data);
                this.eventAdmin.postEvent(event);
            } catch (e) {
                this.logger.error(`[Antigravity Agent] Shout failed for topic ${topic}: ${e.message}`);
            }
        }
    }

    /**
     * Internal persistence for audit logs
     */
    recordAudit(report) {
        try {
            const historyJson = this.pm.load(this.STORAGE_KEY) || "[]";
            const history = Array.isArray(historyJson) ? historyJson : JSON.parse(historyJson);
            
            history.unshift(report);
            // Cap history at 50 entries
            if (history.length > 50) history.pop();
            
            this.pm.store(this.STORAGE_KEY, history);
            this.auditHistory = history;
        } catch (e) {
            this.logger.error(`[Antigravity Agent] Failed to persist audit log: ${e.message}`);
        }
    }
}
