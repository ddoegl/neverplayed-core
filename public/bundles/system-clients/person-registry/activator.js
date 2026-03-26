import { FLOW_SERVICE, YAML_SERVICE, YAML_EDITOR_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);
    const PERSONS_PID = "pandino.persons.data";

    let personsData = pm.load(PERSONS_PID);
    if (!personsData) {
      console.log("Person Registry: Seeding default persons data...");
      const res = await fetch("./bundles/system-clients/person-registry/data/persons.yaml");
      const text = await res.text();
      personsData = yaml.load(text) || [];
      pm.store(PERSONS_PID, personsData);
    }

    const dataService = {
      getPersons: () => personsData,
      setPersons: (newPersons) => {
        personsData = newPersons;
        pm.store(PERSONS_PID, personsData);
        if (globalThis.backofficeState) {
            globalThis.backofficeState.persons = personsData;
            globalThis.backofficeState.recompile?.();
        }
      }
    };
    
    // Provide data as its own service
    context.registerService("infrastructure.persons.data", dataService);

    const flowMetadata = {
      id: "person-registry",
      title: "Person Registry",
      icon: "fas fa-users",
      launch: async (targetElement) => {
        // Shared state for the person registry instance
        const personFlowData = Alpine.reactive({
          persons: personsData,
          editingPerson: null,
          currentStep: "dashboard",

          async loadStep(step) {
            this.currentStep = step;
            const response = await fetch(`./bundles/system-clients/person-registry/templates/${step}.html`);
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
            const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
            if (!editorRef) return alert("YAML Editor Service unavailable!");
            const editor = context.getService(editorRef);
            editor.edit({
              title: "Person Registry Configuration",
              data: this.persons,
              onSave: (newData) => {
                dataService.setPersons(newData);
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

            dataService.setPersons([...this.persons]);
            this.loadStep("dashboard");
          },

          deletePerson(id) {
            if (confirm("Are you sure you want to delete this person?")) {
              this.persons = this.persons.filter(p => p.id !== id);
              dataService.setPersons([...this.persons]);
            }
          }
        });

        // Expose to Alpine on the target element
        targetElement._x_dataStack = [personFlowData, { host: globalThis.backofficeState }];
        await personFlowData.loadStep("dashboard");
      },
    };

    const headers = context.bundle.getHeaders();
    const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
    const config = headers[configKey] ? (typeof headers[configKey] === 'string' ? JSON.parse(headers[configKey]) : headers[configKey]) : {};

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "person-registry",
      "flow.title": flowMetadata.title,
      "flow.icon": flowMetadata.icon,
      ...config
    });
  }
}
