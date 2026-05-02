/**
 * @file Activator for org.neverplayed.person-registry
 * @module platform/bundles/org.neverplayed.person-registry
 */

import { 
    FLOW_SERVICE, 
    PERSONS_SERVICE, 
    PERSON_REGISTRY_FLOW, 
    PERSISTENCE_RESOLVER_SERVICE, 
    YAML_SERVICE, 
    YAML_EDITOR_SERVICE,
    LIMES_SERVICE,
    SESSION_SERVICE
} from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { BaseActivator } from "osgi-base";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

// Legacy objectClass for backward compatibility with shared-types consumers
const PERSONS_SERVICE_LEGACY = "org.neverplayed.infrastructure/persons/data";
const PERSONS_PID = "org.neverplayed.infrastructure/persons";

export default class Activator extends BaseActivator {
    _personsData = [];
    _dataService = null;
    _yaml = null;
    _yamlEditor = null;
    _resolver = null;
    _limes = null;
    _session = null;

    async onStart(context) {
        // 1. Track YAML Service (for seed data parsing)
        this.track(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => {
                this._yaml = context.getService(ref);
                this._hydrateData();
                return this._yaml;
            },
            removedService: () => { this._yaml = null; }
        });

        // 2. Track YAML Editor Service (for raw editing)
        this.track(`(objectClass=${YAML_EDITOR_SERVICE})`, {
            addingService: (ref) => {
                this._yamlEditor = context.getService(ref);
                return this._yamlEditor;
            },
            removedService: () => { this._yamlEditor = null; }
        });

        // 3. Track Persistence Resolver (Sovereign Gravity Oracle)
        this.track(`(objectClass=${PERSISTENCE_RESOLVER_SERVICE})`, {
            addingService: (ref) => {
                this._resolver = context.getService(ref);
                this.logger.info("Person Registry: Connected to Persistence Resolver. Briefing oracle...");
                
                // Rule: Infrastructure Gravity (SDN-0180)
                // Register 'cloud' policy for infrastructure data to ensure multi-realm availability.
                this._resolver.registerPolicy(PERSONS_PID, { tier: 'cloud' });

                // Rule: Sovereign Being Grounding (Ideation: Sovereign Beings)
                // Anchor 'person' beings in the Habitat realm.
                this._resolver.registerPolicy('org.neverplayed.beings/person/', {
                    realm: 'org.neverplayed.realm.habitat',
                    tier: 'cloud'
                });
                
                // Trigger re-hydration once the resolver is ready to ensure correct tiering
                this._hydrateData();
                return this._resolver;
            },
            removedService: () => { this._resolver = null; }
        });

        // 4. Track Limes Service (Institutional Privilege Guard)
        this.track(`(objectClass=${LIMES_SERVICE})`, {
            addingService: (ref) => {
                this._limes = context.getService(ref);
                this.logger.info("Person Registry: Limes connected. Hardening flow access...");
                
                // Register Custom Flow Strategy (ADR-0175 Alignment)
                this._limes.registerStrategy(`FLOW_VIEW:${PERSON_REGISTRY_FLOW}`, {
                    operator: 'AND',
                    matchers: [
                        { type: 'matchAttribute', key: 'isPersonAdmin', value: true },
                        { type: 'matchAttribute', key: 'isRegisteredPerson', value: true }
                    ]
                });
                return this._limes;
            },
            removedService: () => { this._limes = null; }
        });

        // 5. Track Session Service (for Identity Context)
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                
                // Reactive Capability Enrichment (SDN-0165)
                Alpine.effect(() => {
                    this._enrichSessionUser();
                });
                
                return this._session;
            },
            removedService: () => { this._session = null; }
        });

        // 6. Build and Register Data Service
        this._dataService = {
            getPersons: () => this._personsData,
            setPersons: (newPersons) => {
                this._personsData = newPersons;
                this.persistence.store(PERSONS_PID, this._personsData);
            }
        };

        // Dual Registration: new core-types constant + legacy shared-types constant
        context.registerService(PERSONS_SERVICE, this._dataService);
        context.registerService(PERSONS_SERVICE_LEGACY, this._dataService);
        this.logger.info("Person Registry: Data service registered (dual objectClass).");

        // 5. Register Flow Service
        context.registerService(FLOW_SERVICE, this, {
            "flow.id": PERSON_REGISTRY_FLOW,
            "flow.title": "Person Registry",
            "icon": this.config.icon || "fas fa-users",
            "sidebar": this.config.sidebar !== false,
            ...this.config
        });

        this.logger.info("Person Registry: Registered 👥");
    }

    /**
     * Hydrate persons data from persistence, seeding from YAML if empty.
     */
    async _hydrateData() {
        if (!this._resolver || !this._yaml) {
            this.logger.debug("Person Registry: Hydration deferred (Resolver or YAML not ready).");
            return;
        }

        this._personsData = this.persistence.load(PERSONS_PID);

        // Rule: Conservative Seeding (SDN-0185)
        // Seed if data is missing or empty array (initial state or previous failed run).
        const isEmpty = !this._personsData || (Array.isArray(this._personsData) && this._personsData.length === 0);
        
        if (isEmpty) {
            this.logger.info("Person Registry: Seeding default persons data from YAML...");
            try {
                const seedUrl = this.resolveResource("data/persons.yaml");
                const res = await fetch(seedUrl);
                const text = await res.text();
                
                const loaded = this._yaml.load(text);
                if (Array.isArray(loaded) && loaded.length > 0) {
                    this._personsData = loaded;
                    this.persistence.store(PERSONS_PID, this._personsData);
                    this.logger.info(`Person Registry: Seeded ${this._personsData.length} persons.`);
                    this._enrichSessionUser();
                } else if (Array.isArray(loaded)) {
                    this.logger.warn("Person Registry: Seed data is empty array. Skipping store.");
                    this._personsData = [];
                } else {
                    this.logger.warn("Person Registry: Seed data is not an array. Skipping store.");
                    this._personsData = [];
                }
            } catch (err) {
                this.logger.error("Person Registry: Failed to seed data:", err.message);
                this._personsData = [];
            }
        }
    }

    /**
     * Capability Enrichment: Inject domain-specific privileges into the global session.
     */
    _enrichSessionUser() {
        if (!this._session || !this._personsData || this._personsData.length === 0) return;

        const currentUser = this._session.currentUser;
        if (!currentUser || currentUser.id === 'guest') return;

        const person = this._personsData.find(p => p.id === currentUser.id || (p.userids || []).includes(currentUser.id));
        
        const attributes = {
            isRegisteredPerson: !!person,
            isPersonAdmin: person?.authorizations?.some(a => a.company === "person-registry" && a.authorizations.includes("PERSONADMIN")) || false
        };

        // Inject into current user only if changed (prevent reactive loops)
        if (currentUser.attributes.isRegisteredPerson !== attributes.isRegisteredPerson ||
            currentUser.attributes.isPersonAdmin !== attributes.isPersonAdmin) {
            
            Object.assign(currentUser.attributes, attributes);
            this.logger.debug(`Person Registry: Enriched session for ${currentUser.id}`, attributes);
        }
    }

    /**
     * Flow Service Protocol: launch
     */
    async launch(targetElement, _params = {}) {
        this.logger.info("Person Registry: Launching flow...");
        const self = this;

        // 1. Institutional Privilege Guard (Limes)
        if (this._limes && this._session) {
            const currentUser = this._session.currentUser;
            const isRegisteredPerson = !!currentUser.attributes.isRegisteredPerson;
            const isPersonAdmin = !!currentUser.attributes.isPersonAdmin;
            this.logger.info(`Person Registry: Checking access for ${currentUser?.id}. (Registered: ${isRegisteredPerson}, Person Admin: ${isPersonAdmin})`);

            const allowed = this._limes.isAllowed(currentUser, `FLOW_VIEW:${PERSON_REGISTRY_FLOW}`);

            if (!allowed) {
                this.logger.warn(`Person Registry: Access Denied for ${currentUser?.id}. (Registered: ${isRegisteredPerson})`);
                targetElement.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-12 text-center">
                        <div class="w-20 h-20 mb-6 flex items-center justify-center bg-red-100 text-red-600 rounded-full">
                            <i class="fas fa-shield-alt fa-3x"></i>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
                        <p class="text-gray-600 max-w-md mb-8">
                            This governance flow is restricted to registered Personnel with administrative clearance.
                            Please contact the High Council if you believe this is an error.
                        </p>
                        <div class="px-4 py-2 bg-gray-100 rounded text-xs font-mono text-gray-500">
                            REQUIRED: person-admin | IDENTITY: ${currentUser?.id || 'GUEST'} | STATUS: ${isRegisteredPerson ? 'REGISTERED' : 'UNKNOWN'}
                        </div>
                    </div>
                `;
                return;
            }
        }

        // 2. Define Alpine component
        Alpine.data("personRegistryFlow", () => ({
            persons: self._personsData,
            editingPerson: null,
            currentStep: "dashboard",

            async loadStep(step) {
                this.currentStep = step;
                const url = self.resolveResource(`templates/${step}.html`);
                const response = await fetch(url);
                targetElement.innerHTML = await response.text();
            },

            editPerson(person) {
                this.editingPerson = person ? { ...person } : {
                    firstname: "",
                    lastname: "",
                    birthdate: "",
                    emails: "",
                    userids: "",
                };
                this.loadStep("form");
            },

            openYamlEditor() {
                if (!self._yamlEditor) {
                    self.logger.warn("Person Registry: YAML Editor Service unavailable.");
                    return;
                }
                self._yamlEditor.edit({
                    title: "Person Registry Configuration",
                    data: this.persons,
                    onSave: (newData) => {
                        self._dataService.setPersons(newData);
                        this.persons = newData;
                    },
                });
            },

            savePerson() {
                // Convert comma-separated strings to arrays
                if (typeof this.editingPerson.emails === "string") {
                    this.editingPerson.emails = this.editingPerson.emails.split(",").map(e => e.trim()).filter(Boolean);
                }
                if (typeof this.editingPerson.userids === "string") {
                    this.editingPerson.userids = this.editingPerson.userids.split(",").map(id => id.trim()).filter(Boolean);
                }

                if (!this.editingPerson.id) {
                    this.editingPerson.id = "p-" + Math.random().toString(36).substr(2, 9);
                    this.persons.push(this.editingPerson);
                } else {
                    const index = this.persons.findIndex(p => p.id === this.editingPerson.id);
                    if (index > -1) this.persons[index] = this.editingPerson;
                }

                self._dataService.setPersons([...this.persons]);
                this.loadStep("dashboard");
            },

            deletePerson(id) {
                if (confirm("Are you sure you want to delete this person?")) {
                    this.persons = this.persons.filter(p => p.id !== id);
                    self._dataService.setPersons([...this.persons]);
                }
            }
        }));

        // Inject the dashboard template and bind the Alpine component
        targetElement.setAttribute("x-data", "personRegistryFlow");
        const url = this.resolveResource("templates/dashboard.html");
        const response = await fetch(url);
        targetElement.innerHTML = await response.text();
    }
}
