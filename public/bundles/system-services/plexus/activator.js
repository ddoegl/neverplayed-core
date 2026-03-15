import { FLOW_SERVICE, CONFIG_ADMIN_SERVICE, RULES_DATA_SERVICE, BIZ_FUNC_DATA_SERVICE, CAPABILITIES_DATA_SERVICE, LICENSE_DATA_SERVICE, COMPANIES_SERVICE, PLEXUS_ENGINE_SERVICE, PLEXUS_TRACING_UI } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";
import { evaluateDynamic, evaluateCapabilitiesDynamic, SegmentationEngine } from "./evaluator.js";
import { compileEvaluator } from "./compiler.js";


export default class Activator {
    start(context) {
    const mainPid = "plexus.engine";
    
    // Pandino Logger Service
    this.loggerReference = context.getServiceReference('@pandino/pandino/Logger');
    this.pandinoLogger = this.loggerReference ? context.getService(this.loggerReference) : null;

    // Abstract logger instance for context-aware logging
    this.logger = {
        debug: (msg) => {
            if (['DEBUG', 'TRACE'].includes(this.logLevel)) {
                console.log(`%c[Evaluator DEBUG]%c ${msg}`, 'color: #3b82f6; font-weight: bold', 'color: inherit');
                if (this.pandinoLogger && this.pandinoLogger.debug) this.pandinoLogger.debug(`[Evaluator DEBUG] ${msg}`);
            }
        },
        trace: (msg) => {
            if (this.logLevel === 'TRACE') {
                console.log(`%c[Evaluator TRACE]%c ${msg}`, 'color: #8b5cf6; font-weight: bold', 'color: inherit');
                if (this.pandinoLogger && this.pandinoLogger.trace) this.pandinoLogger.trace(`[Evaluator TRACE] ${msg}`);
            }
        },
        info: (msg) => {
            if (this.pandinoLogger && this.pandinoLogger.info) this.pandinoLogger.info(`[Evaluator INFO] ${msg}`);
            else if (this.pandinoLogger && this.pandinoLogger.log) this.pandinoLogger.log(`[Evaluator INFO] ${msg}`);
            else console.log(`[Evaluator INFO] ${msg}`);
        }
    };

    const state = Alpine.reactive({
        rules: {},
        features: {},
        businessFunctions: [],
        licenses: [],
        roleAliases: {}, // Mapping from role-aliases.yaml
        registry: [],   // Data from companies.yaml
        logLevel: "INFO",
        isTraceEnabled: false,
        testUserId: null,
        testBusinessFunctions: [], // Derived labels for UI
        testUserProperties: {},    // Derived properties (self, etc)
        testUserAuthorities: {},   // roleLabel -> entityId
        evaluationResults: null,
        evaluationContext: null,
        traceLogs: [],
        activePrimitives: ["matchAlways", "matchFeature", "matchLicenseholder", "matchRole", "matchProperty"],
        
        get businessFunctionIds() {
            return (this.businessFunctions || []).map(f => f.id);
        },
        
        get availableUsers() {
            const users = [];
            (this.licenses || []).forEach(lic => {
                (lic.USERS || []).forEach(u => {
                    if (!users.find(existing => existing.id === u.id)) {
                        users.push({ 
                            id: u.id, 
                            label: `${u.alias || u.firstname || 'User'} (${u.id})` 
                        });
                    }
                });
            });
            return users.sort((a, b) => a.label.localeCompare(b.label));
        },

        init: () => {
            console.log("PoC Evaluator UI: init() called");

            setTimeout(() => {
                if (!state.testUserId && state.availableUsers.length > 0) {
                    state.testUserId = "6786432";
                }
                state.syncLiveFunctions();
            }, 100);
        },

        syncLiveFunctions: () => {
            const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
            const engine = engineRef ? context.getService(engineRef) : null;
            const matcherEngine = engine ? engine.getMatcherEngine() : null;

            for (const lic of state.licenses) {
                const u = (lic.USERS || []).find(u => u.id === state.testUserId);
                if (u && matcherEngine) {
                    const normalized = matcherEngine.normalizeContext(u, lic, state.registry);

                    // Update State for Dev UI
                    state.testUserProperties.self = normalized.self;
                    state.testUserAuthorities = normalized.userAuthorities;
                    state.testBusinessFunctions = normalized.activeBusinessFunction;
                    return;
                }
            }
            state.testBusinessFunctions = [];
            state.testUserAuthorities = {};
        },

        toggleTrace: () => {
            const ref = context.getServiceReference(CONFIG_ADMIN_SERVICE);
            const ca = ref ? context.getService(ref) : null;
            if (!ca) return;
            const nextLevel = state.isTraceEnabled ? 'INFO' : 'TRACE';
            ca.getConfiguration(mainPid).update({ logLevel: nextLevel });
            globalThis.dispatchEvent(new CustomEvent('config-updated', { detail: { pid: mainPid } }));
        },

        persistActivePrimitives: () => {
            const ref = context.getServiceReference(CONFIG_ADMIN_SERVICE);
            const ca = ref ? context.getService(ref) : null;
            if (!ca) return;
            
            // Push current state to ConfigAdmin
            ca.getConfiguration(mainPid).update({ activePrimitives: Array.from(state.activePrimitives) });
            globalThis.dispatchEvent(new CustomEvent('config-updated', { detail: { pid: mainPid } }));
        },

        runEvaluation: () => {
            console.log("PoC Evaluator UI: runEvaluation() called");
            state.traceLogs = []; 
            
            state.syncLiveFunctions();
            let currentLicense = null;
            const userProfile = (() => {
                for (const lic of state.licenses) {
                    const u = (lic.USERS || []).find(u => u.id === state.testUserId);
                    if (u) {
                        currentLicense = lic;
                        return { ...u, licenseId: lic.id };
                    }
                }
                return null;
            })();
            
            const ctx = {
                userId: state.testUserId,
                activeBusinessFunction: state.testBusinessFunctions,
                userAuthorities: state.testUserAuthorities,
                licenseCustomers: currentLicense ? currentLicense.customers : [],
                ...(userProfile || {}),
                ...(state.testUserProperties || {})
            };
            
            state.evaluationContext = ctx;

            const evalConfig = {
                rules: state.rules,
                features: state.features,
                licenses: state.licenses,
                roleAliases: state.roleAliases,
                activePrimitives: state.activePrimitives,
                logger: {
                    debug: (msg) => { state.traceLogs.push({ type: 'DEBUG', msg }); this.logger.debug(msg); },
                    trace: (msg) => { state.traceLogs.push({ type: 'TRACE', msg }); this.logger.trace(msg); },
                    info: (msg) => { state.traceLogs.push({ type: 'INFO', msg }); this.logger.info(msg); }
                },
                licenseCustomers: currentLicense ? currentLicense.customers : []
            };

            const { grantedKeys } = evaluateCapabilitiesDynamic(evalConfig, ctx);
            state.evaluationResults = Array.from(grantedKeys.keys()).sort();
        }
    });

    // Track Data Services
    context.trackService(`(objectClass=${RULES_DATA_SERVICE})`, {
        addingService: (ref) => { state.ruleStrategies = context.getService(ref).getStrategies() || []; }
    }).open();
    
    context.trackService(`(objectClass=${CAPABILITIES_DATA_SERVICE})`, {
        addingService: (ref) => { 
            const raw = context.getService(ref).getStrategies();
            const caps = Array.isArray(raw) ? raw : (raw?.capabilities || []);
            state.rules = { capabilities: caps };
        }
    }).open();
    
    context.trackService(`(objectClass=${"backoffice.features.data"})`, {
        addingService: (ref) => { state.featureCatalog = context.getService(ref).getFeatures() || {}; }
    }).open();

    context.trackService(`(objectClass=${"backoffice.permissions.data"})`, {
        addingService: (ref) => { state.permissionsRegistry = context.getService(ref).getPermissions() || {}; }
    }).open();
    
    context.trackService(`(objectClass=${BIZ_FUNC_DATA_SERVICE})`, {
        addingService: (ref) => { 
            const funcs = context.getService(ref).getBusinessFunctions() || [];
            state.businessFunctions = funcs;
            // Derive role aliases for the evaluator from business function configuration
            const aliases = {};
            funcs.forEach(f => {
                if (f.roles && f.roles.length > 0) {
                    // Normalize: LEGALREPS (BF) -> LEGALREP (Role Rule)
                    const roleId = f.id === 'LEGALREPS' ? 'LEGALREP' : f.id;
                    // Normalize: space to dash (e.g. managing director -> managing-director)
                    const sanitizedRoles = f.roles.map(r => r.replace(/\s+/g, '-'));
                    aliases[roleId] = sanitizedRoles;
                }
            });
            state.roleAliases = aliases;
        }
    }).open();
    
    context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
        addingService: (ref) => { 
            const data = context.getService(ref).getLicenses() || { LICENSES: [] };
            state.licenses = data.LICENSES || [];
        }
    }).open();

    context.trackService(`(objectClass=${COMPANIES_SERVICE})`, {
        addingService: (ref) => { 
            state.registry = context.getService(ref).getCompanies() || [];
        }
    }).open();

    // Track Config
    context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
        addingService: (ref) => {
            const ca = context.getService(ref);
            const update = () => {
                const props = ca.getConfiguration(mainPid).getProperties() || {};
                state.logLevel = props.logLevel || "INFO";
                state.isTraceEnabled = (state.logLevel === 'TRACE');
                this.logLevel = state.logLevel;
                
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
          getPrimitives: () => Object.keys(SegmentationEngine.Primitives),
          normalizeContext: (u, license, registry = []) => {
              const authorities = { ...(u.userAuthorities || {}) }; 
              const activeIds = [...(u.activeBusinessFunction || [])];
              
              // Safe ID extraction: ensure we have a string for IDs
              const ownerId = u.owner ? (typeof u.owner === 'object' ? u.owner.id : String(u.owner)) : "";
              const holderId = u.holder ? (typeof u.holder === 'object' ? u.holder.id : String(u.holder)) : "";
              
              const ownerName = ownerId.toLowerCase();
              const isSelf = !!ownerId;

              // 1. Derive ADMINISTRATOR role from explicit property field
              if (u.administrator === true || u.administrator === "true") {
                  if (!activeIds.includes('ADMINISTRATOR')) activeIds.push('ADMINISTRATOR');
                  authorities['ADMINISTRATOR'] = u.id;
              }

              // 2. Registry-based derivation (Live detection from companies)
              const licenseCustomers = license ? (license.customers || []) : [];
              registry.forEach(company => {
                  if (licenseCustomers.includes(company.id)) {
                      const rep = (company.legalRepresentatives || []).find(r => r.personId === ownerName);
                      if (rep) {
                          authorities[`LEGALREP (${rep.role})`] = company.id;
                          if (!activeIds.includes('LEGALREPS')) activeIds.push('LEGALREPS');
                      }
                  }
              });

              // 3. License-holder detection (for PrivateRep)
              let isLicenseholder = false;
              if (license && license.licenseholder) {
                  if (Array.isArray(license.licenseholder)) {
                      isLicenseholder = license.licenseholder.some(h => String(h).toLowerCase() === ownerName);
                  } else {
                      isLicenseholder = String(license.licenseholder).toLowerCase() === ownerName;
                  }
              }

              // 4. Role Alias Mapping (Dynamic derivation)
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
                  ...u,
                  userId: u.id,
                  activeBusinessFunction: activeIds,
                  userAuthorities: authorities,
                  licenseCustomers: licenseCustomers,
                  self: isSelf
              };
          }
      })
    });
    
    // Register UI
    const flowMetadata = {
        id: PLEXUS_TRACING_UI,
        title: "Plexus Tracing",
        icon: "fas fa-microscope",
        launch: async (targetElement) => {
            targetElement._x_dataStack = [state];
            const response = await fetch("./bundles/system-services/plexus/templates/tracing-ui.html");
            targetElement.innerHTML = await response.text();
            state.init();
        }
    };
    context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": PLEXUS_TRACING_UI });
    
    // Initial Self-Tests
    setTimeout(() => {
        const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
        if (engineRef) this.runSelfTests(context.getService(engineRef));
    }, 500);
  }

  runSelfTests(engine) {
    this.logger.info("=== Running PoC Self-Tests ===");
    const robbyContext = { userId: "9238451", activeBusinessFunction: ["ADMINISTRATOR"] };
    const annaContext = { userId: "6432432", activeBusinessFunction: [] };
    const johnContext = { userId: "6786432", activeBusinessFunction: ["LEGALREPS"] };
    const multiContext = { userId: "6786432", activeBusinessFunction: ["ADMINISTRATOR", "LEGALREPS"] };
    const jwContext = { userId: "6532478", activeBusinessFunction: ["PRIVATEREP"] };
    const compiledFn = engine.compileEvaluator();

    [robbyContext, annaContext, johnContext, multiContext, jwContext].forEach(ctx => {
        const functionLabel = Array.isArray(ctx.activeBusinessFunction) ? ctx.activeBusinessFunction.join('+') : ctx.activeBusinessFunction;
        this.logger.info(`\nTesting Context for ${ctx.userId} (Functions: ${functionLabel || 'none'})`);
        const dynResult = engine.evaluateCapabilitiesDynamic(ctx);
        const compResult = compiledFn(ctx, this.logger); 
        const dynKeys = Object.keys(dynResult.grantedKeys || {});
        const match = dynKeys.every(k => compResult.has(k)) && dynKeys.length === compResult.size;
        this.logger.info(`    Keys Granted: ${dynKeys.length}, Match: ${match ? "YES" : "NO"}`);
    });
  }

  stop(_context) {
    if (this.loggerReference) {
        if (typeof _context.ungetService === 'function') {
            _context.ungetService(this.loggerReference);
        }
    }
  }
}
