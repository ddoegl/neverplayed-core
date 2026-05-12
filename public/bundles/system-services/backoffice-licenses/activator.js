import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, LICENSE_DATA_SERVICE, PERSONS_SERVICE, COMPANIES_SERVICE, LICENSES_PID, LOG_SERVICE, PLEXUS_KNOWLEDGE_PROVIDER } from "core-types";
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
    if (licenses && !licenses.LICENSES) licenses.LICENSES = [];

    const dataService = {
      getLicenses: () => licenses,
      getKnowledge: () => licenses,
      getLicense: (id) => (licenses?.LICENSES || []).find(l => l.id === id),
      sanitizeUser: (user) => {
        const sanitized = { ...user };
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
                const sanitizedUpdate = dataService.sanitizeUser(user);
                lic.USERS[uIdx] = { ...lic.USERS[uIdx], ...sanitizedUpdate };
                dataService.setLicenses(licenses);
            }
        }
      },
      setLicenses: (newData) => {
        if (newData && Array.isArray(newData.LICENSES)) {
            newData.LICENSES.forEach(lic => {
                if (lic.licenseholder && !Array.isArray(lic.licenseholder)) lic.licenseholder = [lic.licenseholder];
                if (lic.customers && !Array.isArray(lic.customers)) lic.customers = [lic.customers];
                if (Array.isArray(lic.licenseholder)) lic.licenseholder = [...new Set(lic.licenseholder.filter(Boolean))];
                if (Array.isArray(lic.customers)) lic.customers = [...new Set(lic.customers.filter(Boolean))];
                if (Array.isArray(lic.USERS)) lic.USERS = lic.USERS.map(u => dataService.sanitizeUser(u));
            });
        }
        licenses = newData;
        pm.store(LICENSES_PID_VAL, licenses);
        
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
        
        const customers = license.customers || [];
        const companyIds = new Set(companies.map(c => c.id));
        return [...companies, ...persons]
          .filter(c => customers.includes(c.id))
          .map(member => {
            let displayName = member.name || member.id;
            if (member.firstname || member.lastname) displayName = `${member.firstname || ''} ${member.lastname || ''}`.trim();
            const type = companyIds.has(member.id) ? 'company' : 'person';
            return { ...member, type, displayName };
          });
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

    context.registerService(LICENSE_DATA_SERVICE, dataService);

    // Register as Plexus Knowledge Provider
    context.registerService(PLEXUS_KNOWLEDGE_PROVIDER, dataService, { 
        "plexus.domain": "licenses" 
    });

    context.registerService(BO_EXTENSION_SERVICE, {
      id: "licenses",
      name: "License Management",
      icon: "fas fa-users-cog",
      templateUrl: "./bundles/system-services/backoffice-licenses/templates/licenses.html",
      onActivate: (hostState) => {
        if (!hostState.parsedLicenses || typeof hostState.parsedLicenses !== 'object') {
            hostState.parsedLicenses = { LICENSES: [] };
        }
        if (licenses && licenses.LICENSES) hostState.parsedLicenses.LICENSES = licenses.LICENSES;

        hostState.saveLicenses = () => dataService.setLicenses(hostState.parsedLicenses);
        hostState.syncAllPersonUserIds = () => {
            dataService.syncAllPersonUserIds();
            if (licenses) hostState.parsedLicenses.LICENSES = licenses.LICENSES;
        };

        hostState.openLicensesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) { alert("YAML Editor service not available yet."); return; }
          editor.edit({
            title: "License Configuration",
            data: hostState.parsedLicenses,
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
