import { 
    BO_EXTENSION_SERVICE, 
    YAML_EDITOR_SERVICE, 
    PLEXUS_ENGINE_SERVICE,
    LICENSE_DATA_SERVICE,
    RULES_DATA_SERVICE,
    CAPABILITIES_DATA_SERVICE,
    CAMPAIGNS_SERVICE,
    TOPICS_DATA_SERVICE,
    BIZ_FUNC_DATA_SERVICE,
    COMPANIES_SERVICE,
    EVALUATOR_SERVICE,
    FELLOWS_SERVICE,
    PERSONS_SERVICE,
    SESSION_SERVICE,
    EVAL_DATA_SERVICE,
    LIMES_SERVICE,
    LOG_SERVICE,
    LICENSES_PID
} from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  start(context) {
    let logger = console; // Fallback
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("backoffice-evaluation");
            logger.info("BO Evaluation: Bundle started.");
        },
        removedService: () => { logger = console; }
    }).open();
    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const installRecompile = () => {
      const hostState = globalThis.backofficeState || globalThis.businessPortalState || globalThis.retailPortalState;
      if (!hostState) {
          setTimeout(installRecompile, 100);
          return;
      }
      
      // Ensure hostState has the required structure if it's the portal state
      if (!hostState.evaluatedData) {
          hostState.evaluatedData = Alpine.reactive([]);
      }

      // Provide the orchestrator recompile function
      hostState.recompile = () => {
        const toArray = (data) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (typeof data === "object") return Object.entries(data).map(([id, val]) => ({ id, ...val }));
            return [];
        };

        const getSvc = (name) => {
            const ref = context.getServiceReference(name);
            return ref ? context.getService(ref) : null;
        };

        const allStates = [globalThis.backofficeState, globalThis.businessPortalState, globalThis.retailPortalState].filter(Boolean);

        const lSvc = getSvc(LICENSE_DATA_SERVICE);
        const liveLicenses = (lSvc ? lSvc.getLicenses() : null) || hostState.parsedLicenses || pm.load(LICENSES_PID) || { LICENSES: [] };
        
        const allCustomers = [...new Set((liveLicenses.LICENSES || []).flatMap(l => l.customers || []))];
        
        allStates.forEach(st => {
            if (st.parsedLicenses && typeof st.parsedLicenses === 'object') {
                Object.assign(st.parsedLicenses, liveLicenses);
            } else {
                st.parsedLicenses = liveLicenses;
            }
        });
        
        if (!liveLicenses || !liveLicenses.LICENSES || liveLicenses.LICENSES.length === 0) {
           allStates.forEach(st => st.evaluatedData = []);
           return;
        }
        
        const rSvc = getSvc(RULES_DATA_SERVICE);
        if (rSvc) {
            const rules = rSvc.getRules() || {};
            allStates.forEach(st => {
                if (st.parsedRuleStrategies && typeof st.parsedRuleStrategies === 'object') Object.assign(st.parsedRuleStrategies, rules);
                else st.parsedRuleStrategies = rules;
            });
        }

        const capSvc = getSvc(CAPABILITIES_DATA_SERVICE);
        if (capSvc) {
            const raw = capSvc.getStrategies();
            const caps = Array.isArray(raw) ? raw : (raw?.capabilities || []);
            allStates.forEach(st => st.parsedCapabilities = caps);
        }
        
        const cSvc = getSvc(CAMPAIGNS_SERVICE);
        if (cSvc) {
            const camps = toArray(cSvc.getCampaigns());
            const strats = toArray(cSvc.getStrategies());
            allStates.forEach(st => {
                if (Array.isArray(st.parsedCampaigns)) st.parsedCampaigns.splice(0, st.parsedCampaigns.length, ...camps);
                else st.parsedCampaigns = camps;
                if (Array.isArray(st.parsedStrategies)) st.parsedStrategies.splice(0, st.parsedStrategies.length, ...strats);
                else st.parsedStrategies = strats;
            });
        }

        const tSvc = getSvc(TOPICS_DATA_SERVICE);
        if (tSvc) {
            const topics = toArray(tSvc.getTopics());
            const topicStrats = tSvc.getTopicStrategies() || {};
            allStates.forEach(st => {
                if (Array.isArray(st.parsedTopics)) st.parsedTopics.splice(0, st.parsedTopics.length, ...topics);
                else st.parsedTopics = topics;
                if (st.parsedTopicStrategies && typeof st.parsedTopicStrategies === 'object') Object.assign(st.parsedTopicStrategies, topicStrats);
                else st.parsedTopicStrategies = topicStrats;
            });
        }

        const bfSvc = getSvc(BIZ_FUNC_DATA_SERVICE);
        if (bfSvc) {
            const bf = toArray(bfSvc.getBusinessFunctions());
            allStates.forEach(st => {
                if (Array.isArray(st.parsedBusinessFunctions)) st.parsedBusinessFunctions.splice(0, st.parsedBusinessFunctions.length, ...bf);
                else st.parsedBusinessFunctions = bf;
            });
        }

        const compSvc = getSvc(COMPANIES_SERVICE);
        if (compSvc) {
            const comps = compSvc.getCompanies() || [];
            allStates.forEach(st => st.registry = comps);
        }
        
        // Find all Evaluator Services, sorted by their "order" property
        const evaluatorRefs = context.getServiceReferences(EVALUATOR_SERVICE) || [];
        const evaluators = evaluatorRefs.map(ref => context.getService(ref)).filter(svc => svc && typeof svc.evaluate === "function");
        evaluators.sort((a, b) => (a.order || 100) - (b.order || 100));
        
        logger.info(`Evaluation: Recompiling with ${evaluators.length} evaluators and ${ liveLicenses.LICENSES?.length || 0 } licenses.`);
        
        // Base user capabilities map
        let userCapabilities = [];
        
        // Extract basic user structures from licenses
        const allUsers = [];
        liveLicenses.LICENSES.forEach(lic => {
            (lic.USERS || []).forEach(u => allUsers.push({ user: u, license: lic }));
        });
        
        // Merge authorizations and roles while keeping master objects pristine
        const fSvc = getSvc(FELLOWS_SERVICE);
        const pSvc = getSvc(PERSONS_SERVICE);
        
        const evaluatedUsers = allUsers.map(uInfo => {
            // Create a runtime projection of the user to avoid "staining" the license data
            const userProjection = { ...uInfo.user };
            
            // Check if this user is a Fellow and inject their authorizations
            if (fSvc && pSvc) {
                const fellows = fSvc.getData()?.FELLOWS || [];
                const personId = String(uInfo.user.owner || uInfo.user.holder || "");
                // SCOPING FIX: Ensure fellow record matches current license customers
                const licenseCustomers = uInfo.license.customers || [];
                const fellow = fellows.find(f => 
                  String(f.personId || f.person) === personId && 
                  licenseCustomers.some(c => String(c) === String(f.fellowOf || f.customerId))
                );
                
                if (fellow) {
                    const person = (pSvc.getPersons() || []).find(p => String(p.id) === personId);
                    
                    // Promote Fellow data to user context for matching engine
                    userProjection.permissionbundles = userProjection.permissionbundles || [];
                    
                    if (fellow.authorizations && Array.isArray(fellow.authorizations)) {
                        fellow.authorizations.forEach(authKey => {
                            const normalized = authKey.toUpperCase();
                            userProjection[normalized.toLowerCase()] = true; 
                            if (!userProjection.permissionbundles.includes(normalized)) {
                                userProjection.permissionbundles.push(normalized);
                            }
                        });
                    }
                    if (person && person.authorizations) {
                        const targetCompany = String(fellow.fellowOf || fellow.customerId);
                        const compAuth = person.authorizations.find(a => String(a.company) === targetCompany);
                        if (compAuth && compAuth.authorizations) {
                            compAuth.authorizations.forEach(authKey => {
                                const normalized = authKey.toUpperCase();
                                userProjection[normalized.toLowerCase()] = true; 
                                if (!userProjection.permissionbundles.includes(normalized)) {
                                    userProjection.permissionbundles.push(normalized);
                                }
                            });
                        }
                    }
                    if (fellow.role) {
                        const normalizedRole = fellow.role.toUpperCase();
                        userProjection[normalizedRole.toLowerCase()] = true;
                        if (!userProjection.permissionbundles.includes(normalizedRole)) {
                            userProjection.permissionbundles.push(normalizedRole);
                        }
                    }
                }
            }
            
            return { user: userProjection, license: uInfo.license };
        });

        // Add spooky fellows (Fellows without a matching license user)
        if (fSvc && pSvc) {
            const fellows = fSvc.getData()?.FELLOWS || [];
            const persons = pSvc.getPersons() || [];
            
            fellows.forEach(f => {
                const person = persons.find(p => p.id === (f.personId || f.person));
                if (person) {
                    const alreadyPresent = evaluatedUsers.some(entry => String(entry.user.owner || entry.user.holder) === String(person.id));
                    if (!alreadyPresent) {
                        const fellowId = f.fellowOf || f.customerId;
                        const spoofedUser = { id: person.id, alias: person.firstname, channel: "business", permissionbundles: [] };
                        
                        if (f.authorizations) f.authorizations.forEach(a => {
                            const normalized = a.toUpperCase();
                            spoofedUser[normalized.toLowerCase()] = true;
                            spoofedUser.permissionbundles.push(normalized);
                        });
                        if (f.role) {
                            const normalized = f.role.toUpperCase();
                            spoofedUser[normalized.toLowerCase()] = true;
                            spoofedUser.permissionbundles.push(normalized);
                        }

                        const spoofedLicense = {
                           id: "fellow-" + f.id,
                           channel: "business",
                           customers: [fellowId]
                        };
                        evaluatedUsers.push({ user: spoofedUser, license: spoofedLicense });
                    }
                }
            });
        }
        
        // Retrieve matcher Engine
        const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
        const matcherEngine = engineRef ? context.getService(engineRef).getMatcherEngine() : null;

        userCapabilities = evaluatedUsers.map(uInfo => {
           let channels = ['business'];
           if (uInfo.user.channel) {
               channels = Array.isArray(uInfo.user.channel) ? uInfo.user.channel : [uInfo.user.channel];
           } else if (uInfo.license.channel) {
               channels = Array.isArray(uInfo.license.channel) ? uInfo.license.channel : [uInfo.license.channel];
           }
           
           let normalizedUser = uInfo.user;
           if (matcherEngine) {
               normalizedUser = matcherEngine.normalizeContext(uInfo.user, uInfo.license, hostState.registry || []);
           }

           const mappedRoles = (normalizedUser.activeBusinessFunction || []).map(bf => ({ [bf]: [] }));

           const entry = {
               user: uInfo.user.id || Object.keys(uInfo.user)[0],
               rawUser: normalizedUser,
               license: uInfo.license,
               channels: channels,
               roles: mappedRoles,
               capabilities: [],
               campaigns: [],
               topics: []
           };
           
           if (entry.user === '9238451' || entry.user === 'robby') {
               logger.debug(`Built entry for ${entry.user}: ` + JSON.stringify(entry));
           }
           
           return entry;
        });

        // ensure current user is always evaluated (especially for superuser 'dd')
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        const session = sessionRef ? context.getService(sessionRef) : null;
        if (session && session.currentUser) {
            const currentUserId = session.currentUser.id || session.currentUser.username;
            const alreadyPresent = userCapabilities.some(c => String(c.user) === String(currentUserId));
            if (!alreadyPresent) {
            if (session.currentUser) logger.info("Evaluation: Adding virtual entry for current user: " + currentUserId);
                
                
                const roles = [...new Set([...(session.currentUser.roles || []), 'ADMINISTRATOR', 'LEGALREPS', 'DOSIGNEE'])];
                const superPermissions = ['DO_VIEW_ALLOWED', 'DO_SIGN_ALLOWED', 'DO_AUTHORIZE_ALLOWED', 'DO_TRADE_ALLOWED', 'DO_VIEW', 'DO_SIGN', 'DO_AUTHORIZE', 'DO_TRADE'];
                const grantedKeys = (session.currentUser.capabilities || []).reduce((acc, k) => ({ ...acc, [k]: true }), {});
                superPermissions.forEach(pk => grantedKeys[pk] = true);

                userCapabilities.push({
                    user: currentUserId,
                    rawUser: { ...session.currentUser, scaStrategy: 'superuser', roles },
                    license: { id: 'admin-virtual', customers: allCustomers },
                    channels: ['business', 'retail'],
                    roles: roles.map(r => ({ [r]: [] })),
                    capabilities: [{
                        id: 'superuser-capabilities',
                        label: 'Superuser Capabilities',
                        permissions: superPermissions.map(pk => ({ key: pk, label: pk }))
                    }],
                    campaigns: [],
                    topics: [],
                    grantedKeys
                });
            }
        }

        // Loop through all registered evaluators and pass the capability chain
        for (const evaluatorSvc of evaluators) {
             userCapabilities = evaluatorSvc.evaluate(userCapabilities, liveLicenses, hostState);
        }

        // --- Reactive Update (Splice Pattern) ---
        allStates.forEach(st => {
            if (!Array.isArray(st.evaluatedData)) {
                st.evaluatedData = Alpine.reactive([]);
            }
            st.evaluatedData.splice(0, st.evaluatedData.length, ...userCapabilities);
        });
        
        const ddEntry = userCapabilities.find(u => u.user === 'dd');
        logger.debug(`Evaluation: Recompiled ${userCapabilities.length} users. 'dd' entry found: ${!!ddEntry} (DOs: ${ddEntry?.domainObjects?.length || 0})`);
        
        if (hostState.selectedUserIndex) {
            const licList = liveLicenses.LICENSES || [];
            const uIdx = hostState.selectedUserIndex.usrIdx;
            const lIdx = hostState.selectedUserIndex.licIdx;
           if (licList[lIdx] && licList[lIdx].USERS && licList[lIdx].USERS[uIdx]) {
                const rawUsr = licList[lIdx].USERS[uIdx];
                const targetId = rawUsr.id || Object.keys(rawUsr)[0];
                hostState.selectedUserCap = hostState.evaluatedData.find(c => String(c.user) === String(targetId));
           } else {
                hostState.selectedUserCap = null;
           }
        }
      };

      // Auto-compile once on startup
      setTimeout(() => {
          if (hostState.recompile) hostState.recompile();
      }, 500);

      hostState.openEvaluatorLogs = () => {
         const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
         const editor = context.getService(editorRef);
         if (hostState.selectedUserCap && editor) {
            editor.edit({
               title: "Evaluator Ast: " + hostState.selectedUserCap.user,
               data: hostState.selectedUserCap,
               readOnly: true
            });
         }
      };

      // Register capability lookup service
      const evalDataService = {
          getCapabilities: (userId) => {
              const entry = hostState.evaluatedData.find(d => String(d.user) === String(userId));
              return entry ? entry.capabilities : [];
          },
          getFlattenedCapabilities: (userId) => {
              const entry = hostState.evaluatedData.find(d => String(d.user) === String(userId));
              if (!entry) return [];
              
              const keys = new Set();
              // 1. From pre-calculated grantedKeys (fast path)
              if (entry.grantedKeys) {
                  Object.keys(entry.grantedKeys).forEach(k => keys.add(k.toLowerCase()));
              }
              // 2. Fallback for legacy categories
              if (entry.capabilities) {
                  entry.capabilities.forEach(cat => {
                      (cat.permissions || []).forEach(p => keys.add(p.key.toLowerCase()));
                  });
              }
              return Array.from(keys);
          },
          hasPermissions: (userId, requiredPermissions = []) => {
              if (requiredPermissions.length === 0) return true;
              const entry = hostState.evaluatedData.find(d => String(d.user) === String(userId));
              if (!entry) return false;

              return requiredPermissions.every(req => {
                  const normalized = req.toLowerCase().replace(/:/g, '_');
                  // 0. Strict Bootstrap Restriction: Never allow User Management
                  if (normalized === 'usermanagement_manage_allowed' && entry.rawUser?.scaStrategy === 'bootstrap') {
                      logger.warn("Evaluation: Blocking User Management for Bootstrap User:", userId);
                      return false;
                  }
                  // 1. Check pre-calculated grantedKeys first
                  if (entry.grantedKeys) {
                      // Case-insensitive lookup (we stored them as-is, but check lower-case too)
                      const found = Object.keys(entry.grantedKeys).some(k => k.toLowerCase() === normalized);
                      if (found) return true;
                  }
                  // 2. Fallback to flattened scan
                  const flattened = evalDataService.getFlattenedCapabilities(userId);
                  return flattened.includes(normalized);
              });
          }
      };
      context.registerService(EVAL_DATA_SERVICE, evalDataService);
      
      // Dynamic synchronization: Recompile when critical data services appear
      const criticalServices = [PLEXUS_ENGINE_SERVICE, LIMES_SERVICE, CAMPAIGNS_SERVICE, RULES_DATA_SERVICE, TOPICS_DATA_SERVICE, FELLOWS_SERVICE, BIZ_FUNC_DATA_SERVICE, EVALUATOR_SERVICE];
      criticalServices.forEach(sId => {
          context.trackService(`(objectClass=${sId})`, {
              addingService: () => { 
                logger.info(`Evaluation: Service added [${sId}], triggering recompile.`);
                
                // Ensure all portal states are synced
                [globalThis.backofficeState, globalThis.businessPortalState, globalThis.retailPortalState].forEach(st => {
                  if (st && typeof st.recompile === 'function') st.recompile();
                });
                
                hostState.recompile?.(); 
              },
              removedService: () => {
                [globalThis.backofficeState, globalThis.businessPortalState, globalThis.retailPortalState].forEach(st => {
                  if (st && typeof st.recompile === 'function') st.recompile();
                });
                hostState.recompile?.();
              }
          }).open();
      });

      hostState.recompile(); // Populate data immediately
    };

    installRecompile();

    // Ensure we re-evaluate when selection changes by watching the hostState
    setTimeout(() => {
        const hostState = globalThis.backofficeState || globalThis.businessPortalState;
        if (hostState && typeof hostState.recompile === 'function') {
            Alpine.effect(() => {
                const lic = hostState.currentLicense;
                logger.debug("Evaluation: Selection changed detected in hostState:", lic);
                hostState.recompile();
            });
        }
    }, 1000);

    context.registerService(BO_EXTENSION_SERVICE, {
      id: "backoffice-evaluation",
      name: "Evaluation",
      icon: "fas fa-stethoscope",
      templateUrl: "./bundles/system-services/backoffice-evaluation/templates/overview.html",
      order: 10,
      onActivate: (hostState) => {
        hostState.detailTab = 'capabilities';
        hostState.currentView = "backoffice-evaluation";
        hostState.recompile?.(); // Ensure fresh compilation when opening the tab
      }
    });

  }

  async stop(_context) {}
}
