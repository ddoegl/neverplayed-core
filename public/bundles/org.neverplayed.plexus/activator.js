import { 
    CONFIG_ADMIN_SERVICE, 
    PLEXUS_ENGINE_SERVICE, 
    PLEXUS_PID, 
    LOG_SERVICE,
    PERCEIVER_SERVICE,
    PLEXUS_ENRICHER_SERVICE,
    PLEXUS_KNOWLEDGE_PROVIDER,
    PLEXUS_EVALUATOR_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        const mainPid = PLEXUS_PID;
        this.logger = console;
        this.enricher = null;
        this.evaluator = null;

        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("plexus");
            }
        }).open();

        // Track the Evaluator Service (SDN-0206 - Modularity Compliance)
        context.trackService(`(objectClass=${PLEXUS_EVALUATOR_SERVICE})`, {
            addingService: (ref) => {
                this.evaluator = context.getService(ref);
                return this.evaluator;
            },
            removedService: () => { this.evaluator = null; }
        }).open();

        const state = {
            rules: {},
            featureCatalog: {},
            licenses: [],
            roleAliases: {},
            registry: []
        };

        // Domain Handlers
        const domainHandlers = {
            "capabilities": (data) => { 
                const caps = Array.isArray(data) ? data : (data?.capabilities || []);
                state.rules = { capabilities: caps };
            },
            "features": (data) => { state.featureCatalog = data || {}; },
            "business-functions": (data) => { 
                const funcs = data || [];
                const aliases = {};
                funcs.forEach(f => {
                    if (f.roles && f.roles.length > 0) {
                        const roleId = f.id === 'LEGALREPS' ? 'LEGALREP' : f.id;
                        aliases[roleId] = f.roles.map(r => r.replace(/\s+/g, '-'));
                    }
                });
                state.roleAliases = aliases;
            },
            "licenses": (data) => { 
                const d = data || { LICENSES: [] };
                state.licenses = d.LICENSES || [];
            },
            "companies": (data) => { state.registry = data || []; }
        };

        context.trackService(`(objectClass=${PLEXUS_KNOWLEDGE_PROVIDER})`, {
            addingService: (ref) => {
                const domain = ref.getProperty("plexus.domain");
                const provider = context.getService(ref);
                if (domain && domainHandlers[domain]) domainHandlers[domain](provider.getKnowledge());
                return provider;
            }
        }).open();

        context.trackService(`(objectClass=${PLEXUS_ENRICHER_SERVICE})`, {
            addingService: (ref) => {
                this.enricher = context.getService(ref);
                return this.enricher;
            }
        }).open();

        // Register Engine Service
        context.registerService(PLEXUS_ENGINE_SERVICE, {
          evaluate: (matchers, operator, ctx, runtimeConfig = {}) => {
              if (!this.evaluator) return false;
              const config = {
                  enricher: this.enricher,
                  catalog: state.featureCatalog,
                  licenses: state.licenses,
                  roleAliases: state.roleAliases,
                  logger: this.logger,
                  ...runtimeConfig
              };
              return this.evaluator.evaluateMatchers(matchers, operator || 'AND', ctx, config);
          },
          getMatcherEngine: () => ({
              evaluate: (matchers, operator, ctx) => {
                  if (!this.evaluator) return false;
                  return this.evaluator.evaluateMatchers(matchers, operator, ctx, {
                      enricher: this.enricher,
                      roleAliases: state.roleAliases,
                      licenseCustomers: state.licenses.flatMap(l => l.customers || [])
                  });
              },
              getPrimitives: () => {
                  if (!this.evaluator) return [];
                  return Object.keys(this.evaluator.Primitives);
              }
          })
        });

        this.logger.info("Plexus Engine: Operational (Service-based) 👁️");
    }

    stop() {}
}
