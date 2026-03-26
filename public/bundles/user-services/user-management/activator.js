import { 
  FLOW_SERVICE,
  LICENSE_DATA_SERVICE,
  PERSONS_SERVICE 
} from "shared-types";

export default class Activator {
  async start(context) {
    const serviceObj = {
      id: "user-management",
      name: "User Management",
      icon: "fas fa-users-cog",
      templateUrl: "./bundles/user-services/user-management/templates/dashboard.html",
      launch: async (targetElement) => {
        // Simple launcher for standalone or explicit portal use
        const res = await fetch("./bundles/user-services/user-management/templates/dashboard.html");
        targetElement.innerHTML = await res.text();
      },
      onActivate: (hostState) => {
        console.log("User Management: Activating - injecting methods into hostState");
        
        // Helper for resilient service lookup
        const getSvc = (sid) => {
            const ref = context.getServiceReference(sid);
            return ref ? context.getService(ref) : null;
        };

        // --- Reactive State ---
        if (!hostState.selectedUserId) hostState.selectedUserId = null;

        // --- Business Logic: Authorization Assignment ---
        hostState.performUserAssignment = (userId, personId, relationType) => {
          console.log(`User Management: performUserAssignment(userId=${userId}, personId=${personId}, type=${relationType})`);
          
          const licenseDataSvc = getSvc(LICENSE_DATA_SERVICE);
          if (!licenseDataSvc) {
            console.error("User Management: licenseDataSvc NOT available");
            return;
          }
          const licenses = licenseDataSvc.getLicenses();
          console.log("User Management: Searching in", licenses?.LICENSES?.length, "licenses...");

          const license = licenses.LICENSES?.find(l => 
            l.USERS && l.USERS.some(u => {
                const uId = String(u.id || Object.keys(u)[0]);
                return uId === String(userId);
            })
          );
          
          if (!license) {
            console.error(`User Management: License NOT found for user ${userId}`);
            return;
          }
          console.log("User Management: Found license:", license.id);

          const user = license.USERS.find(u => {
              const uId = String(u.id || Object.keys(u)[0]);
              return uId === String(userId);
          });
          
          if (!user) {
            console.error(`User Management: User ${userId} NOT found in license ${license.id}`);
            return;
          }

          if (relationType === 'Owner') {
            user.owner = personId;
            if (personId) user.holder = null; 
          } else {
            user.holder = personId;
            if (personId) user.owner = null;
          }

          console.log(`User Management: Updating user ${userId} holder to ${user.holder} and owner to ${user.owner}`);

          // Trigger reactivity and sync
          licenseDataSvc.setLicenses(licenses);
          
          // Recompile global state to ensure parsedLicenses is updated
          if (globalThis.backofficeState?.recompile) {
              globalThis.backofficeState.recompile();
          } else {
              hostState.recompile?.();
          }
          
          // Force UI refresh to reflect changes in the registry immediately
          setTimeout(() => {
            hostState.loadStep(hostState.currentStep);
            console.log("User Management: UI Refreshed for", hostState.currentStep);
          }, 100);

          console.log("User Management: performUserAssignment completed and synced.");
        };

        // --- Business Logic: Sync Person UserIDs ---
        hostState.syncAllPersonUserIds = () => {
          const personsSvc = getSvc(PERSONS_SERVICE);
          const licenseDataSvc = getSvc(LICENSE_DATA_SERVICE);
          
          if (!personsSvc || !licenseDataSvc) {
            console.warn("User Management: Sync failed - services missing", { personsSvc: !!personsSvc, licenseDataSvc: !!licenseDataSvc });
            return;
          }

          const persons = personsSvc.getPersons();
          const licensesData = licenseDataSvc.getLicenses();

          // Clear corporate owned mappings
          persons.forEach(p => { p.userids = [] });

          // Rebuild
          if (licensesData.LICENSES) {
            licensesData.LICENSES.forEach(lic => {
              (lic.USERS || []).forEach(user => {
                const userId = user.id || Object.keys(user)[0];
                if (userId && user.owner) {
                  const p = persons.find(person => person.id === user.owner);
                  if (p) {
                    if (!p.userids.includes(userId)) p.userids.push(userId);
                  }
                }
              });
            });
          }
          
          personsSvc.setPersons(persons);
          licenseDataSvc.setLicenses(licensesData);
          hostState.recompile?.();
        };

        // --- Helper: Permission Keys Resolution (Harmonized) ---
        hostState.getAvailablePermissionKeys = (_rules, _licenseData) => {
          const categories = {};
          
          // Modern harmonized structure: hostState.parsedCapabilities is an array of strategies
          const caps = hostState.parsedCapabilities || [];
          
          const addFromStrategy = (strat) => {
            // Determine category from strategy id or common markers
            let category = strat.id || "Global";
            if (category.includes('LEGALREP')) category = "Legal Representative";
            if (category.includes('PRIVATE')) category = "Private Representative";
            if (category.includes('ADMIN')) category = "Administrator";
            if (category.includes('GUARANTEE')) category = "Guarantee";
            if (category.includes('LETTER_OF_CREDIT')) category = "Trade Finance";
            if (category.includes('DO') || category.includes('DOSIGNEE')) category = "Domain Objects";

            if (!categories[category]) categories[category] = new Set();
            const target = categories[category];
            
            // 1. Direct Keys
            if (Array.isArray(strat.keys)) strat.keys.forEach(k => target.add(k));
            
            // 2. Feature-scoped keys
            if (Array.isArray(strat.features)) {
                strat.features.forEach(feat => {
                    if (Array.isArray(feat.keys)) feat.keys.forEach(k => target.add(k));
                });
            }
          };

          caps.forEach(addFromStrategy);

          const result = {};
          Object.keys(categories).sort().forEach(cat => {
            result[cat] = Array.from(categories[cat]).sort();
          });
          return result;
        };

        // Standard sync method bridge
        hostState.syncLicensesToYaml = () => {
           const licenseDataSvc = getSvc(LICENSE_DATA_SERVICE);
           if (licenseDataSvc) {
               licenseDataSvc.setLicenses(hostState.parsedLicenses);
               hostState.recompile?.();
           } else {
               console.warn("User Management: syncLicensesToYaml failed - service missing");
           }
        };

        // Expose to global context for templates that use globalThis.getAvailablePermissionKeys
        globalThis.getAvailablePermissionKeys = hostState.getAvailablePermissionKeys;
        globalThis.syncAllPersonUserIds = hostState.syncAllPersonUserIds;
      }
    };

    context.registerService(FLOW_SERVICE, serviceObj, {
      "flow.id": "user-management",
      "flow.title": "User Management",
      "flow.icon": "fas fa-users-cog",
      "flowType": "admin-flow",
      "channels": ["business-channel-web"],
      "templateUrl": "./bundles/user-services/user-management/templates/dashboard.html"
    });

    context.registerService(FLOW_SERVICE, serviceObj, {
      "flow.id": "holder-registry",
      "flow.title": "Holder Registry",
      "flow.icon": "fas fa-id-badge",
      "flowType": "admin-flow",
      "channels": ["business-channel-web"],
      "templateUrl": "./bundles/user-services/user-management/templates/holder-registry.html"
    });

    context.registerService(FLOW_SERVICE, serviceObj, {
      "flow.id": "manage-permissions",
      "flow.title": "Manage Permissions",
      "flow.icon": "fas fa-shield-halved",
      "flowType": "admin-flow",
      "channels": ["business-channel-web"],
      "templateUrl": "./bundles/user-services/user-management/templates/manage-permissions.html"
    });

    await Promise.resolve();
  }

  async stop(_context) {}
}
