import { 
    CONFIG_ADMIN_SERVICE, 
    PLEXUS_ENGINE_SERVICE, 
    PLEXUS_PID, 
    LOG_SERVICE,
    PLEXUS_KNOWLEDGE_PROVIDER
} from "core-types";
import { evaluateDynamic, evaluateCapabilitiesDynamic, SegmentationEngine, normalizeContext as normalizeContextCore } from "./evaluator.js";
import { compileEvaluator } from "./compiler.js";

export default class Activator {
    start(context) {
        const mainPid = PLEXUS_PID;
        
        // Pandino Logger Service
        this.loggerReference = context.getServiceReference(LOG_SERVICE);
        this.pandinoLogger = this.loggerReference ? context.getService(this.loggerReference) : null;

        this.logger = {
            debug: (msg) => this.pandinoLogger ? this.pandinoLogger.debug(msg) : console.debug(`[Plexus DEBUG] ${msg}`),
            trace: (msg) => this.pandinoLogger ? this.pandinoLogger.trace(msg) : console.log(`[Plexus TRACE] ${msg}`),
            info: (msg) => this.pandinoLogger ? this.pandinoLogger.info(msg) : console.info(`[Plexus INFO] ${msg}`),
            warn: (msg) => this.pandinoLogger ? this.pandinoLogger.warn(msg) : console.warn(`[Plexus WARN] ${msg}`),
            error: (msg) => this.pandinoLogger ? this.pandinoLogger.error(msg) : console.error(`[Plexus ERROR] ${msg}`)
        };

        const state = {
            rules: {},
            featureCatalog: {},
            businessFunctions: [],
            licenses: [],
            roleAliases: {},
            registry: [],
            permissionsRegistry: {},
            logLevel: "INFO",
            activePrimitives: ["matchAlways", "matchFeature", "matchLicenseholder", "matchRole", "matchProperty"]
        };

        // Domain Handlers (Bring Your Own Sense Mapping)
        const domainHandlers = {
            "rules": (data) => { state.ruleStrategies = data || []; },
            "capabilities": (data) => { 
                const raw = data;
                const caps = Array.isArray(raw) ? raw : (raw?.capabilities || []);
                state.rules = { capabilities: caps };
            },
            "features": (data) => { state.featureCatalog = data || {}; },
            "permissions": (data) => { state.permissionsRegistry = data || {}; },
            "business-functions": (data) => { 
                const funcs = data || [];
                state.businessFunctions = funcs;
                const aliases = {};
                funcs.forEach(f => {
                    if (f.roles && f.roles.length > 0) {
                        const roleId = f.id === 'LEGALREPS' ? 'LEGALREP' : f.id;
                        const sanitizedRoles = f.roles.map(r => r.replace(/\s+/g, '-'));
                        aliases[roleId] = sanitizedRoles;
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

        // Generic Knowledge Provider Tracker
        context.trackService(`(objectClass=${PLEXUS_KNOWLEDGE_PROVIDER})`, {
            addingService: (ref) => {
                const domain = ref.getProperty("plexus.domain");
                const provider = context.getService(ref);
                if (domain && domainHandlers[domain]) {
                    this.logger.info(`Plexus: Knowledge Provider arrived for domain: [${domain}]`);
                    const knowledge = provider.getKnowledge();
                    domainHandlers[domain](knowledge);
                } else {
                    this.logger.warn(`Plexus: Unknown or missing domain for Knowledge Provider: ${domain}`);
                }
                return provider;
            }
        }).open();

        // Track Config
        context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                const ca = context.getService(ref);
                const update = () => {
                    const props = ca.getConfiguration(mainPid).getProperties() || {};
                    state.logLevel = props.logLevel || "INFO";
                    if (props.activePrimitives && Array.isArray(props.activePrimitives)) {
                        state.activePrimitives = props.activePrimitives;
                    }
                };
                update();
                globalThis.addEventListener('config-updated', (e) => {
                    if (e.detail === mainPid || (e.detail && e.detail.pid === mainPid)) update();
                });
            }
        }).open();

        // Register Engine Service
        context.registerService(PLEXUS_ENGINE_SERVICE, {
          evaluateCapabilitiesDynamic: (ctx) => evaluateCapabilitiesDynamic({
              rules: state.rules,
              catalog: state.featureCatalog,
              licenses: state.licenses,
              roleAliases: state.roleAliases,
              activePrimitives: state.activePrimitives,
              logger: this.logger
          }, ctx),
          compileEvaluator: () => compileEvaluator({
              rules: state.rules,
              catalog: state.featureCatalog,
              licenses: state.licenses,
              roleAliases: state.roleAliases,
              activePrimitives: state.activePrimitives
          }),
          getMatcherEngine: () => ({
              evaluate: (matchers, operator, ctx) => SegmentationEngine.evaluateMatchers(matchers, operator, ctx, {
                  roleAliases: state.roleAliases,
                  licenseCustomers: state.licenses.flatMap(l => l.customers || [])
              }),
              evaluateDynamic: (config, context) => {
                  const fullConfig = {
                      ...config,
                      catalog: state.featureCatalog,
                      licenses: state.licenses,
                      roleAliases: state.roleAliases,
                      activePrimitives: state.activePrimitives,
                      logger: this.logger
                  };
                  return evaluateDynamic(fullConfig, context);
              },
              evaluateCapabilitiesDynamic: (rules, context, extraConfig = {}) => {
                  const rulePayload = Array.isArray(rules) ? { capabilities: rules } : rules;
                  const licensePayload = extraConfig.license ? (Array.isArray(extraConfig.license) ? extraConfig.license : [extraConfig.license]) : state.licenses;
                  
                  return evaluateCapabilitiesDynamic({
                      rules: rulePayload,
                      catalog: state.featureCatalog,
                      licenses: licensePayload,
                      licenseCustomers: extraConfig.license ? (extraConfig.license.customers || []) : state.licenses.flatMap(l => l.customers || []),
                      roleAliases: state.roleAliases,
                      activePrimitives: state.activePrimitives,
                      logger: this.logger
                  }, context);
              },
              normalizeContext: (u, license, registry = [], surrogate = null, realm = null) => {
                  // 1. Core Normalization (Identity + Persona + Realm)
                  const result = normalizeContextCore(u, license, registry, surrogate, realm);

                  // 2. Domain Enrichment (Roles, Authorities, etc.)
                  const authorities = { ...(result.userAuthorities || {}) }; 
                  const activeIds = [...(result.activeBusinessFunction || [])];
                  
                  const ownerId = u.owner ? (typeof u.owner === 'object' ? u.owner.id : String(u.owner)) : "";
                  const ownerName = ownerId.toLowerCase();
                  const isSelf = !!ownerId;

                  if (u.administrator === true || u.administrator === "true") {
                      if (!activeIds.includes('ADMINISTRATOR')) activeIds.push('ADMINISTRATOR');
                      authorities['ADMINISTRATOR'] = u.id;
                  }

                  const licenseCustomers = license ? (license.customers || []) : [];
                  if (registry && Array.isArray(registry)) {
                      registry.forEach(company => {
                          if (licenseCustomers.includes(company.id)) {
                              const rep = (company.legalRepresentatives || []).find(r => r.personId === ownerName);
                              if (rep) {
                                  authorities[`LEGALREP (${rep.role})`] = company.id;
                                  if (!activeIds.includes('LEGALREPS')) activeIds.push('LEGALREPS');
                              }
                          }
                      });
                  }

                  let isLicenseholder = false;
                  if (license && license.licenseholder) {
                      if (Array.isArray(license.licenseholder)) {
                          isLicenseholder = license.licenseholder.some(h => String(h).toLowerCase() === ownerName);
                      } else {
                          isLicenseholder = String(license.licenseholder).toLowerCase() === ownerName;
                      }
                  }

                  Object.keys(state.roleAliases).forEach(roleId => {
                      const aliases = state.roleAliases[roleId];
                      if (!Array.isArray(aliases)) return;
                      
                      let hasRole = false;
                      aliases.forEach(a => {
                          if (a === 'self' && isSelf) {
                               if (roleId === 'PRIVATEREP') {
                                   if (isLicenseholder) {
                                       authorities[`${roleId} (${a})`] = ownerName;
                                       hasRole = true;
                                   }
                               } else {
                                   authorities[`${roleId} (${a})`] = ownerName;
                                   hasRole = true;
                               }
                          } else if (u[a] === true || u[a] === "true") {
                              authorities[`${roleId} (${a})`] = u[a];
                              hasRole = true;
                          }
                      });
                      if (hasRole && !activeIds.includes(roleId)) activeIds.push(roleId);
                  });
                  
                  const existingBfs = u.permissionbundles || [];
                  existingBfs.forEach(bf => {
                      if (!activeIds.includes(bf)) activeIds.push(bf);
                  });

                  return {
                      ...result,
                      activeBusinessFunction: activeIds,
                      userAuthorities: authorities,
                      licenseCustomers: licenseCustomers,
                      self: isSelf
                  };
              },
              getPrimitives: () => Object.keys(SegmentationEngine.Primitives)
          })
        });

        // Optional Self-Tests (Delayed to allow providers to arrive)
        setTimeout(() => {
            const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
            if (engineRef) this.runSelfTests(context.getService(engineRef));
        }, 5000);
    }

    runSelfTests(engine) {
        this.logger.info("=== Plexus Engine: Running Self-Tests ===");
        const ctx = { userId: "9238451", activeBusinessFunction: ["ADMINISTRATOR"] };
        try {
            const result = engine.evaluateCapabilitiesDynamic(ctx);
            this.logger.info(`    Test Complete. Keys Granted: ${Object.keys(result.grantedKeys || {}).length}`);
        } catch (err) {
            this.logger.error("    Test Failed:", err.message);
        }
    }

    stop(context) {
        if (this.loggerReference) {
            context.ungetService(this.loggerReference);
        }
    }
}
