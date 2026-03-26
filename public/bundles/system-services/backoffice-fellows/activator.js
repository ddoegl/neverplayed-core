import { YAML_SERVICE, FELLOWS_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, COMPANIES_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const FELLOWS_PID = "pandino.backoffice.fellows";
    let data = { FELLOWS: [], AUTHORIZATIONS: [] };

    const dataService = {
      getData: () => data,
      setData: (newData) => {
        data = newData;
        pm.store(FELLOWS_PID, data);
        globalThis.dispatchEvent(new CustomEvent('fellows-updated', { detail: { action: 'setData' } }));
      },
      getFellows: (customerId) => {
        return (data.FELLOWS || []).filter(f => f.fellowOf === customerId);
      },
      addFellow: (fellow) => {
        const personId = fellow.personId || fellow.person;
        const fellowOf = fellow.fellowOf || fellow.customerId;
        const normalized = {
            ...fellow,
            personId,
            fellowOf,
            id: fellow.id || `${personId}-${fellowOf}`,
            authorizations: fellow.authorizations || []
        };
        delete normalized.person;
        delete normalized.customerId;

        data.FELLOWS.push(normalized);
        pm.store(FELLOWS_PID, data);

        const eventAdminRef = context.getServiceReference('@pandino/event-admin/EventAdmin');
        const eventFactoryRef = context.getServiceReference('@pandino/event-admin/EventFactory');
        if (eventAdminRef && eventFactoryRef) {
           const eventAdmin = context.getService(eventAdminRef);
           const eventFactory = context.getService(eventFactoryRef);
           eventAdmin.postEvent(eventFactory.build('backoffice/fellows/updated', { action: 'addFellow', fellow: normalized }));
        }
        globalThis.dispatchEvent(new CustomEvent('fellows-updated', { detail: { action: 'addFellow', fellow: normalized } }));
      },
      reconcile: async () => {
        console.log("BO Fellows: Reconciling data sources...");
        
        // 1. Seed Data
        const fellowsRes = await fetch("./bundles/system-services/backoffice-fellows/data/fellows.yaml");
        const seedYaml = yaml.load(await fellowsRes.text()) || {};
        const seedFellows = Array.isArray(seedYaml.FELLOWS) ? seedYaml.FELLOWS : [];

        // 2. Persisted Data
        const persisted = pm.load(FELLOWS_PID) || { FELLOWS: [], AUTHORIZATIONS: [] };
        
        // 3. Registry Data
        const compsRef = context.getServiceReference(COMPANIES_SERVICE);
        const companies = compsRef ? context.getService(compsRef).getCompanies() : [];
        const registryFellows = [];
        companies.forEach(company => {
            (company.legalRepresentatives || []).forEach(rep => {
                registryFellows.push({
                    personId: rep.personId,
                    fellowOf: company.id,
                    type: 'legal-representative',
                    status: 'active',
                    role: rep.role,
                    joinedAt: new Date().toISOString(),
                    authorizations: []
                });
            });
        });

        // 4. Merge Logic (Priority: PM > Registry > Seed)
        const map = new Map();
        const addToMap = (f) => {
            const pId = f.personId || f.person;
            const fOf = f.fellowOf || f.customerId;
            const id = f.id || `${pId}-${fOf}`;
            if (map.has(id)) {
                map.set(id, { ...f, ...map.get(id) }); // Existing (higher priority) wins
            } else {
                map.set(id, { ...f, personId: pId, fellowOf: fOf, id, authorizations: f.authorizations || [] });
            }
        };

        seedFellows.forEach(addToMap);
        registryFellows.forEach(addToMap);
        (persisted.FELLOWS || []).forEach(addToMap);

        const mergedFellows = Array.from(map.values()).map(f => {
            const n = { ...f };
            delete n.person; delete n.customerId;
            return n;
        });

        data = {
            FELLOWS: mergedFellows,
            AUTHORIZATIONS: seedYaml.AUTHORIZATIONS || persisted.AUTHORIZATIONS || []
        };
        pm.store(FELLOWS_PID, data);

        // Bridge to host states for global availability
        [globalThis.backofficeState, globalThis.businessPortalState].forEach(state => {
            if (state) {
                state.fellowsData = data;
                state.recompile?.();
            }
        });

        globalThis.dispatchEvent(new CustomEvent('fellows-updated', { detail: { action: 'reconcile' } }));
      }
    };

    context.registerService(FELLOWS_SERVICE, dataService);
    
    // Perform initial reconciliation
    setTimeout(() => dataService.reconcile(), 500);

    const eventHandlerObj = {
        handleEvent: (event) => {
            if (event.getTopic() === 'infrastructure/companies/updated') {
                dataService.reconcile();
            }
        }
    };
    context.registerService('@pandino/event-admin/EventHandler', eventHandlerObj, {
        'event.topics': ['infrastructure/companies/updated']
    });

    // Register Extension Service
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "fellows",
      name: "Fellow Management",
      icon: "fas fa-users-crown",
      templateUrl: "./bundles/system-services/backoffice-fellows/templates/fellows-overview.html",
      onActivate: (hostState) => {
        const getSvc = (sid) => {
          const ref = context.getServiceReference(sid);
          return ref ? context.getService(ref) : null;
        };

        // Inject data into hostState for Alpine usage
        hostState.fellowsData = data;

        hostState.openFellowsEditor = () => {
          const editor = getSvc(YAML_EDITOR_SERVICE);
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Fellows Configuration",
            data: hostState.fellowsData,
            onSave: (newData) => {
              dataService.setData(newData);
              hostState.fellowsData = data; // Sync back
            },
          });
        };

        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
