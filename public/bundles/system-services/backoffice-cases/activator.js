import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { 
    CASE_SERVICE, 
    YAML_SERVICE, 
    FELLOWS_SERVICE, 
    SIGNING_DATA_SERVICE, 
    COMPANIES_SERVICE, 
    PERSONS_SERVICE, 
    SESSION_SERVICE, 
    LICENSE_DATA_SERVICE, 
    ACTION_REGISTRY_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    CASE_ADDED_TOPIC,
    CASE_UPDATED_TOPIC,
    ACTION_SERVICE,
    LOG_SERVICE,
    CASES_PID,
    INVITATIONS_PID
} from "../../../shared-types.js";

export default class Activator {
  start(context) {
    let logger = console; // Fallback
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("backoffice-cases");
            logger.info("BO Cases: Bundle started.");
        },
        removedService: () => { logger = console; }
    }).open();
    let yamlService = null;
    context.trackService(`(objectClass=${YAML_SERVICE})`, {
        addingService: (ref) => { yamlService = context.getService(ref); },
        removedService: () => { yamlService = null; }
    }).open();

    let signingService = null;
    context.trackService(`(objectClass=${SIGNING_DATA_SERVICE})`, {
        addingService: (ref) => { signingService = context.getService(ref); },
        removedService: () => { signingService = null; }
    }).open();

    let companiesService = null;
    context.trackService(`(objectClass=${COMPANIES_SERVICE})`, {
        addingService: (ref) => { companiesService = context.getService(ref); },
        removedService: () => { companiesService = null; }
    }).open();

    let personsService = null;
    context.trackService(`(objectClass=${PERSONS_SERVICE})`, {
        addingService: (ref) => { personsService = context.getService(ref); },
        removedService: () => { personsService = null; }
    }).open();

    let sessionService = null;
    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
        addingService: (ref) => { sessionService = context.getService(ref); },
        removedService: () => { sessionService = null; }
    }).open();

    let licenseService = null;
    context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
        addingService: (ref) => { licenseService = context.getService(ref); },
        removedService: () => { licenseService = null; }
    }).open();

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = pmRef ? context.getService(pmRef) : null;
    
    const fellowsServiceRef = context.getServiceReference(FELLOWS_SERVICE);
    let fellowsService = fellowsServiceRef ? context.getService(fellowsServiceRef) : null;

    context.trackService(`(objectClass=${FELLOWS_SERVICE})`, {
        addingService: (ref) => { fellowsService = context.getService(ref); },
        removedService: () => { fellowsService = null; }
    }).open();
    
    let data = pm?.load(CASES_PID);

    const seedData = async () => {
        if (data || !pm) return;
        console.log("BO Cases: Checking for seed data...");
        try {
            const res = await fetch("./bundles/system-services/backoffice-cases/data/cases.yaml");
            if (res.ok && yamlService) {
                const text = await res.text();
                const loaded = yamlService.load(text);
                data = { CASES: Array.isArray(loaded) ? loaded : [] };
                pm.store(CASES_PID, data);
                console.log("BO Cases: Seeded data from YAML.");
            }
        } catch (e) {
            console.error("BO Cases: Failed to seed data", e);
        }
    };

    context.trackService(`(objectClass=${YAML_SERVICE})`, {
        addingService: (ref) => { 
            yamlService = context.getService(ref); 
            if (!data) seedData();
        },
        removedService: () => { yamlService = null; }
    }).open();

    if (!data) data = { CASES: [] };
    if (!data.CASES) data.CASES = [];

    const caseService = {
      getCases: () => data.CASES,
      getCase: (id) => {
        const c = data.CASES.find(caseItem => caseItem.id === id);
        console.log(`BO Cases: getCase(${id}) -> Status: ${c?.status || "NOT_FOUND"} (Total records: ${data.CASES.length})`);
        return c;
      },
      addCase: (caseItem) => {
        data.CASES.push(caseItem);
        if (pm) pm.store(CASES_PID, data);
        console.log("BO Cases: Case added:", caseItem.id);
        
        // Notify via EventAdmin
        const eventAdminRef = context.getServiceReference(EVENT_ADMIN_SERVICE);
        const eventFactoryRef = context.getServiceReference(EVENT_FACTORY_SERVICE);
        if (eventAdminRef && eventFactoryRef) {
            const eventAdmin = context.getService(eventAdminRef);
            const eventFactory = context.getService(eventFactoryRef);
            const event = eventFactory.build(CASE_ADDED_TOPIC, { id: caseItem.id });
            eventAdmin.postEvent(event);
        }
      },
      createCase: (typeId, metadata, html = null) => {
        if (!signingService) {
            console.error("BO Cases: Cannot create case, signingService not available.");
            return null;
        }

        const strategy = signingService.resolveStrategy(typeId);
        if (!strategy) {
            console.error("BO Cases: Cannot create case, strategy not resolved for type:", typeId);
            return null;
        }

        const signatures = [];
        const persons = personsService ? personsService.getPersons() : [];

        // Resolve Company LRs if needed
        if (strategy.selector === 'company-lrs' || strategy.selector === 'joint-lrs-person') {
            const companyId = metadata.companyId;
            const companies = companiesService ? companiesService.getCompanies() : [];
            const company = companies.find(c => c.id === companyId);
            
            if (company && company.legalRepresentatives) {
                company.legalRepresentatives.forEach(rep => {
                    const p = persons.find(per => per.id === rep.personId);
                    signatures.push({
                        signee: p ? `${p.firstname} ${p.lastname}` : rep.personId,
                        personId: rep.personId,
                        role: rep.role,
                        status: 'pending'
                    });
                });
            }
        }

        // Resolve Person signature if needed
        if (strategy.selector === 'person' || strategy.selector === 'joint-lrs-person') {
            const personId = metadata.targetPersonId;
            const p = persons.find(per => per.id === personId);
            if (p) {
                signatures.push({
                    signee: `${p.firstname} ${p.lastname}`,
                    personId: p.id,
                    role: 'INDIVIDUAL',
                    status: 'pending'
                });
            }
        }

        // --- Safeguard: If no signatures found, add the requester or target person as fallback ---
        if (signatures.length === 0) {
            console.warn("BO Cases: No signatures resolved for strategy, applying fallback.");
            const personId = metadata.targetPersonId;
            const p = persons ? persons.find(per => per.id === personId) : null;
            const currentUser = sessionService?.currentUser;
            
            signatures.push({
                signee: p ? `${p.firstname} ${p.lastname}` : (currentUser?.alias || 'System Fallback'),
                personId: p?.id || currentUser?.id || 'system',
                role: 'SIGNATORY',
                status: 'pending'
            });
        }

        // --- Visibility Scoping: Ensure Limes and UI can filter this case ---
        const caseCustomers = new Set();
        if (metadata.companyId) caseCustomers.add(metadata.companyId);
        if (metadata.customerId) caseCustomers.add(metadata.customerId);
        if (metadata.targetPersonId) caseCustomers.add(metadata.targetPersonId);
        
        // Add all signatories as potential viewees
        signatures.forEach(s => { if(s.personId) caseCustomers.add(s.personId); });

        const caseId = `${typeId.substring(0,4).toUpperCase()}-${Date.now()}`;
        const currentUser = sessionService?.currentUser;

        const newCase = {
            id: caseId,
            name: metadata.title || `${typeId} Case`,
            description: metadata.description || `Automated case for ${typeId}`,
            status: 'pending',
            type: typeId,
            customers: Array.from(caseCustomers),
            metadata: {
                ...metadata,
                requester: currentUser?.alias || 'system',
                createdAt: new Date().toISOString()
            },
            signatures,
            html: html || `<div class="prose"><p>Standard document for <strong>${typeId}</strong></p></div>`
        };

        caseService.addCase(newCase);
        return newCase;
      },
      updateCase: (caseId, updates) => {
        const index = data.CASES.findIndex(c => c.id === caseId);
        if (index !== -1) {
            const oldStatus = data.CASES[index].status;
            data.CASES[index] = { ...data.CASES[index], ...updates };
            const newStatus = data.CASES[index].status;

            if (pm) pm.store(CASES_PID, data);
            console.log(`BO Cases: Updated Case ${caseId}: ${oldStatus} -> ${newStatus}`);
            
            // Fulfillment Logic: If case just transitioned to 'signed' and is an authorization grant
            if (oldStatus === 'pending' && newStatus === 'signed' && data.CASES[index].type === 'authorization-grant' && fellowsService) {
                const meta = data.CASES[index].metadata;
                if (meta && meta.targetPersonId && meta.authId && meta.companyId) {
                    console.log("BO Cases: Fulfilling authorization grant for fellow:", meta.targetPersonId, "at company:", meta.companyId);
                    
                    const fellowData = fellowsService.getData();
                    if (fellowData && fellowData.FELLOWS) {
                        const fIndex = fellowData.FELLOWS.findIndex(f => 
                           (f.personId === meta.targetPersonId || f.person === meta.targetPersonId) && 
                           (f.customerId === meta.companyId || f.fellowOf === meta.companyId)
                        );
                        
                        if (fIndex !== -1) {
                            const fellow = fellowData.FELLOWS[fIndex];
                            fellow.authorizations = fellow.authorizations || [];
                            
                            // Fine-grained authorizations are stored directly in the fellow representation
                            if (!fellow.authorizations.includes(meta.authId)) {
                                fellow.authorizations.push(meta.authId);
                                fellowsService.setData(fellowData);
                                console.log("BO Cases: Authorization fulfilled and saved to fellow.");
                            } else {
                                console.log("BO Cases: Authorization already exits on fellow.");
                            }
                        } else {
                            console.warn("BO Cases: Could not find fellow matching targetPersonId and companyId to grant authorization.");
                        }
                    }
                }
            }

            // Fulfillment Logic: Fellowship Grant
            if (oldStatus === 'pending' && newStatus === 'signed' && data.CASES[index].type === 'fellowship-grant' && fellowsService) {
                const meta = data.CASES[index].metadata;
                if (meta && meta.targetPersonId && meta.companyId) {
                    console.log("BO Signing: Fulfilling fellowship grant for person:", meta.targetPersonId, "at company:", meta.companyId);
                    
                    const fellowData = fellowsService.getData();
                    const existing = fellowData?.FELLOWS?.find(f => 
                         (f.personId === meta.targetPersonId || f.person === meta.targetPersonId) && 
                         (f.fellowOf === meta.companyId || f.customerId === meta.companyId)
                    );

                    if (!existing) {
                        fellowsService.addFellow({
                            personId: meta.targetPersonId,
                            fellowOf: meta.companyId,
                            type: meta.role || 'fellow',
                            status: 'active',
                            joinedAt: new Date().toISOString()
                        });
                        console.log("BO Signing: Fellowship fulfilled via FellowsService.");
                    } else {
                        console.log("BO Signing: Fellowship already exists.");
                    }
                }
            }

            // Fulfillment Logic: User Adoption
            if (oldStatus === 'pending' && newStatus === 'signed' && data.CASES[index].type === 'user-adoption' && licenseService) {
                const meta = data.CASES[index].metadata;
                if (meta && meta.targetPersonId && meta.userId) {
                    console.log("BO Signing: Fulfilling User Adoption for userId:", meta.userId, "to owner:", meta.targetPersonId);
                    
                    const licenses = licenseService.getLicenses();
                    if (licenses && licenses.LICENSES) {
                        const license = licenses.LICENSES.find(l => l.id === meta.licenseId);
                        if (license && license.USERS) {
                            const user = license.USERS.find(u => u.id === meta.userId);
                            if (user) {
                                user.owner = meta.targetPersonId;
                                user.holder = null; // Owner takes precedence
                                licenseService.setLicenses(licenses);
                                console.log("BO Signing: User Adoption fulfilled and persisted.");
                            }
                        }
                    }
                }
            }

            // Fulfillment Logic: License Holder Assignment (Ownership Transfer)
            if (oldStatus === 'pending' && newStatus === 'signed' && data.CASES[index].type === 'licenseholder-assignment' && licenseService) {
                const meta = data.CASES[index].metadata;
                if (meta && meta.targetLicenseId && meta.targetPersonId) {
                    console.log("BO Cases: Fulfilling License Holder Assignment for license:", meta.targetLicenseId, "to person:", meta.targetPersonId);
                    
                    const license = JSON.parse(JSON.stringify(licenseService.getLicense(meta.targetLicenseId) || {}));
                    if (license && license.id) {
                        const resolvedId = meta.targetPersonId;
                        
                        // 1. Update License Holder (Company Customers list)
                        license.licenseholder = [resolvedId];
                        license.customers = license.customers || [];
                        if (resolvedId && !license.customers.includes(resolvedId)) {
                            license.customers.push(resolvedId);
                        }

                        // 2. Bind Admin User ID to the person (Owner binding)
                        const adminUser = (license.USERS || []).find(u => u.scaStrategy === 'bootstrap' || u.administrator);
                        if (adminUser) {
                            adminUser.owner = resolvedId;
                            adminUser.holder = null;
                            adminUser.scaStrategy = 'modern-swtoken-only';
                            
                            // Sync names if available
                            if (meta.firstname) adminUser.firstname = meta.firstname;
                            if (meta.lastname) adminUser.lastname = meta.lastname;
                        }

                        licenseService.updateLicense(license);
                        console.log("BO Cases: License Holder Assignment fulfilled and license updated.");

                        // 3. Mark the associated invitation as 'admitted'
                        // But we can reach via PM if needed, or simply let the event system notify others
                        // For now, we trust the license update is the main functional part.
                        // We also trigger a search for the invitation and update it directly via PM
                        if (pm && meta.invitationCode) {
                            const invData = pm.load(INVITATIONS_PID);
                            if (invData && invData.INVITATIONS) {
                                const inv = invData.INVITATIONS.find(i => i.code?.toUpperCase() === meta.invitationCode.toUpperCase());
                                if (inv) {
                                    inv.status = "admitted";
                                    inv.admittedAt = new Date().toISOString();
                                    pm.store(INVITATIONS_PID, invData);
                                    console.log("BO Cases: Associated invitation marked as admitted:", meta.invitationCode);
                                }
                            }
                        }
                    }
                }
            }

            // Notify via EventAdmin
            const eventAdminRef = context.getServiceReference(EVENT_ADMIN_SERVICE);
            const eventFactoryRef = context.getServiceReference(EVENT_FACTORY_SERVICE);
            if (eventAdminRef && eventFactoryRef) {
                const eventAdmin = context.getService(eventAdminRef);
                const eventFactory = context.getService(eventFactoryRef);
                const event = eventFactory.build(CASE_UPDATED_TOPIC, { id: caseId });
                eventAdmin.postEvent(event);
            }
            return true;
        }
        return false;
      }
    };

    context.registerService(CASE_SERVICE, caseService);
    console.log("BO Cases: Service registered as:", CASE_SERVICE);

    // Register as a generic Action Service
    context.registerService(ACTION_SERVICE, {
        execute: (params) => {
            return caseService.createCase(
                params.caseTypeId,
                {
                    companyId: params.companyId,
                    targetPersonId: params.targetPersonId,
                    title: params.title || `Case for ${params.companyId || params.targetPersonId || 'Atomic Flow'}`,
                    description: params.description || `Created via Atomic Flow`
                },
                params.html
            );
        }
    }, {
        "action.id": "synthetic.case.create"
    });

    // Self-register metadata for documentation
    context.trackService(`(objectClass=${ACTION_REGISTRY_SERVICE})`, {
        addingService: (ref) => {
            const registry = context.getService(ref);
            registry.register({
                id: 'synthetic.case.create',
                label: '📁 Create Case',
                description: 'Creates a new case in the backoffice system.',
                params: {
                    caseTypeId: 'The type ID of the case to create.',
                    companyId: 'The company ID to link (optional).',
                    targetPersonId: 'The target person ID to link (optional).',
                    title: 'Custom title for the case.',
                    description: 'Detailed description for the case.',
                    html: 'Raw HTML content for the document.',
                    linkToProperty: 'UI variable to store the new Case ID in.'
                }
            });
        }
    }).open();
  }
}
