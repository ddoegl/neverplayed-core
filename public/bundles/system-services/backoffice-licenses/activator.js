import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, LICENSE_DATA_SERVICE, PERSONS_SERVICE, COMPANIES_SERVICE, LICENSES_PID, LOG_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const LICENSES_PID_VAL = LICENSES_PID;
    let logger = null;

    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
        },
        removedService: () => { logger = null; }
    }).open();

    // Load/Seed Data
    let licenses = null;
    try {
        licenses = pm.load(LICENSES_PID_VAL);
    } catch (e) {
        if (logger) logger.warn("BO Licenses: Error loading persisted data, falling back to seed.", e);
        else console.warn("BO Licenses: Error loading persisted data, falling back to seed.", e);
        licenses = null;
    }

    if (!licenses || typeof licenses !== "object" || !licenses.LICENSES) {
      if (logger) logger.info("BO Licenses: Seeding default data...");
      else console.log("BO Licenses: Seeding default data...");
      const res = await fetch("./bundles/system-services/backoffice-licenses/data/licenses.yaml");
      const text = await res.text();
      const loaded = yaml.load(text);
      const rawLicenses = Array.isArray(loaded) ? loaded : [];
      // Normalize seeded data
      rawLicenses.forEach(lic => {
          if (lic.licenseholder && !Array.isArray(lic.licenseholder)) lic.licenseholder = [lic.licenseholder];
          if (lic.customers && !Array.isArray(lic.customers)) lic.customers = [lic.customers];
      });
      licenses = { LICENSES: rawLicenses };
      pm.store(LICENSES_PID, licenses);
    }
    // Final check for robust structure
    if (licenses && !licenses.LICENSES) licenses.LICENSES = [];

    const dataService = {
      getLicenses: () => licenses,
      getLicense: (id) => (licenses?.LICENSES || []).find(l => l.id === id),
      sanitizeUser: (user) => {
        const sanitized = { ...user };
        // Strip runtime-only properties derived from evaluation and session enrichment
        delete sanitized.capabilities;
        delete sanitized.grantedKeys;
        delete sanitized.userAuthorities;
        delete sanitized.activeBusinessFunction;
        delete sanitized.self;
        return sanitized;
      },
      updateLicense: (license) => {
        if (!license || !license.id) return;
        const index = (licenses.LICENSES || []).findIndex(l => l.id === license.id);
        if (index !== -1) {
            licenses.LICENSES[index] = license;
            dataService.setLicenses(licenses);
        }
      },
      updateUser: (licenseId, user) => {
        if (!licenseId || !user || !user.id) return;
        const lic = (licenses.LICENSES || []).find(l => l.id === licenseId);
        if (lic && lic.USERS) {
            const uIdx = lic.USERS.findIndex(u => String(u.id) === String(user.id));
            if (uIdx !== -1) {
                // Sanitize user before merging into persistent store
                const sanitizedUpdate = dataService.sanitizeUser(user);
                lic.USERS[uIdx] = { ...lic.USERS[uIdx], ...sanitizedUpdate };
                dataService.setLicenses(licenses);
            }
        }
      },
      setLicenses: (newData) => {
        if (logger) logger.info("LicenseDataService: setLicenses called with " + (newData?.LICENSES?.length || 0) + " licenses");
        // Deep sanitize and DE-DUPLICATE all data
        if (newData && Array.isArray(newData.LICENSES)) {
            newData.LICENSES.forEach(lic => {
                // Normalize to ARRAYS to avoid Alpine character-iteration bug
                if (lic.licenseholder && !Array.isArray(lic.licenseholder)) {
                   lic.licenseholder = [lic.licenseholder];
                }
                if (lic.customers && !Array.isArray(lic.customers)) {
                   lic.customers = [lic.customers];
                }

                // De-duplicate license holders and customers
                if (Array.isArray(lic.licenseholder)) {
                   lic.licenseholder = [...new Set(lic.licenseholder.filter(Boolean))];
                }
                if (Array.isArray(lic.customers)) {
                   lic.customers = [...new Set(lic.customers.filter(Boolean))];
                }
                
                if (Array.isArray(lic.USERS)) {
                    lic.USERS = lic.USERS.map(u => dataService.sanitizeUser(u));
                }
            });
        }

        licenses = newData;
        pm.store(LICENSES_PID_VAL, licenses);
        if (logger) logger.info("LicenseDataService: Persisted to PM.");
        
        // Bridge to host states for global availability
        [globalThis.backofficeState, globalThis.businessPortalState].forEach(state => {
            if (state) {
                if (state.parsedLicenses && typeof state.parsedLicenses === 'object') {
                    Object.assign(state.parsedLicenses, licenses);
                } else {
                    state.parsedLicenses = licenses;
                }
                state.recompile?.();
            }
        });
      },
      getFilteredMembers: (licenseId) => {
        if (!licenseId) return [];
        const license = (licenses.LICENSES || []).find(l => l.id === licenseId);
        if (!license) return [];
        
        const persRef = context.getServiceReference(PERSONS_SERVICE);
        const persons = persRef ? context.getService(persRef).getPersons() : [];
        const compsRef = context.getServiceReference(COMPANIES_SERVICE);
        const companies = compsRef ? context.getService(compsRef).getCompanies() : [];
        
        if (logger) logger.debug("LicenseDataService: getFilteredMembers for: " + licenseId);
        const customers = license.customers || [];
        
        const companyIds = new Set(companies.map(c => c.id));
        const result = [...companies, ...persons]
          .filter(c => customers.includes(c.id))
          .map(member => {
            let displayName = member.name || member.id;
            if (member.firstname || member.lastname) {
                displayName = `${member.firstname || ''} ${member.lastname || ''}`.trim();
            }
            const type = companyIds.has(member.id) ? 'company' : 'person';
            return { ...member, type, displayName };
          });

        // Result is empty if no formal customers are found
        if (logger) logger.debug("Filtered result: " + result.map(r => r.id || r.displayName).join(", "));
        return result;
      },
      syncAllPersonUserIds: () => {
        const personsRef = context.getServiceReference(PERSONS_SERVICE);
        if (!personsRef) return;
        const personSvc = context.getService(personsRef);
        const personsList = personSvc.getPersons() || [];

        (licenses.LICENSES || []).forEach((lic) => {
          (lic.USERS || []).forEach((user) => {
            const person = personsList.find((p) => String(p.id) === String(user.id));
            if (person) {
              user.firstname = person.firstname;
              user.lastname = person.lastname;
            }
          });
        });
        dataService.setLicenses(licenses);
      },
    };

    // Provide data as its own service
    context.registerService(LICENSE_DATA_SERVICE, dataService);

    // Register Extension Service
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "licenses",
      name: "License Management",
      icon: "fas fa-users-cog",
      templateUrl: "./bundles/system-services/backoffice-licenses/templates/licenses.html",
      onActivate: (hostState) => {
        // Ensure we point to the SAME object so Alpine's reactivity and our persistence stay in sync
        if (!hostState.parsedLicenses || typeof hostState.parsedLicenses !== 'object') {
            hostState.parsedLicenses = { LICENSES: [] };
        }
        
        // Create a wrapper for normalization
        const normalize = (data) => {
          if (data && Array.isArray(data.LICENSES)) {
            data.LICENSES.forEach(lic => {
              if (lic.licenseholder && !Array.isArray(lic.licenseholder)) lic.licenseholder = [lic.licenseholder];
              if (lic.customers && !Array.isArray(lic.customers)) lic.customers = [lic.customers];
            });
          }
        };

        // Synchronize our local reference and the host state
        if (licenses && licenses.LICENSES) {
           normalize(licenses); // Normalize existing data before sharing
           hostState.parsedLicenses.LICENSES = licenses.LICENSES;
        }

        hostState.saveLicenses = () => {
            // Persist the actual object being edited in the UI
            dataService.setLicenses(hostState.parsedLicenses);
        };
        hostState.syncAllPersonUserIds = () => {
            dataService.syncAllPersonUserIds();
            // After internal update, push back to hostState if needed
            if (licenses) hostState.parsedLicenses.LICENSES = licenses.LICENSES;
        };

        hostState.openLicensesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "License Configuration",
            data: hostState.parsedLicenses, // Use the shared object
            onSave: (newData) => {
              dataService.setLicenses(newData);
              if (licenses) hostState.parsedLicenses.LICENSES = licenses.LICENSES;
            },
          });
        };

        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
