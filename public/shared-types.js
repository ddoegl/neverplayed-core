// shared-types.js
export const FLOW_SERVICE = "prototyper.flow.service";
export const SESSION_SERVICE = "prototyper.session.service";
export const NAV_SERVICE = "prototyper.nav.service";
export const YAML_SERVICE = "prototyper.yaml.service";
export const SYSTEM_RESET_SERVICE = "prototyper.system.ResetService";
export const CONFIG_ADMIN_UI_FLOW = "config-admin-ui";
export const BO_EXTENSION_SERVICE = "prototyper.backoffice.extension";
export const YAML_EDITOR_SERVICE = "prototyper.backoffice.yaml.editor";
export const ENV_SERVICE = "prototyper.env.service";
export const CONFIG_ADMIN_SERVICE = "pandino.config.admin.ConfigAdmin";
export const SYSTEM_READY_SERVICE = "prototyper.system.ready";
export const SELECTION_SERVICE = "prototyper.selection.service";
export const LICENSE_DATA_SERVICE = "backoffice.licenses.data";
export const FELLOWS_SERVICE = "backoffice.fellows.data";
export const INVITATION_SERVICE = "backoffice.invitations.data";
export const TENANT_DATA_SERVICE = "backoffice.data.tenants";
export const EMAIL_SERVICE = "prototyper.email.service";
export const PERSONS_SERVICE = "infrastructure.persons.data";
export const COMPANIES_SERVICE = "infrastructure.companies.data";
export const CASE_SERVICE = "backoffice.cases.data";
export const BPMN_ENGINE_SERVICE = "prototyper.bpmn.engine";
export const SIGNING_DATA_SERVICE = "backoffice.signing.data";
export const RULES_DATA_SERVICE = "backoffice.rules.data";
export const BIZ_FUNC_DATA_SERVICE = "backoffice.business.functions";
export const CAPABILITIES_DATA_SERVICE = "backoffice.capabilities.data";
export const PERMISSION_DATA_SERVICE = "backoffice.permissions.data";
export const FEATURE_DATA_SERVICE = "backoffice.features.data";
export const PLEXUS_ENGINE_SERVICE = "plexus.engine";
export const PLEXUS_TRACING_UI = "plexus.tracing.ui";
export const LIMES_SERVICE = "prototyper.limes.service";
export const DOMAIN_OBJECT_REGISTRY_SERVICE = "backoffice.domain.object.registry";

// Bundle Types for Governance
export const BUNDLE_TYPE_ORDER = "order-flow";
export const BUNDLE_TYPE_SERVICE = "service-flow";
export const BUNDLE_TYPE_SYSTEM = "system-flow";
export const BUNDLE_TYPE_ADMIN = "admin-flow";
export const BUNDLE_TYPE_CLIENT = "client-flow";
export const BUNDLE_TYPE_ENVIRONMENT = "environment-flow";
export const BUNDLE_TYPE_ATOMIC = "atomic-flow";
export const ATOMIC_SPEC_INGESTION_SERVICE = "prototyper.atomic.ingestion";
export const ATOMIC_MARKER_HEADER = "X-Atomic-Bundle";

export const ATOMIC_BUNDLE_SERVICE = "prototyper.atomic.bundle";

export const SHELL_CONFIG_PID = "shell.config";
 
export const BUNDLE_TYPE_REGISTRY = {
    [BUNDLE_TYPE_ORDER]: { title: "Order Flows", icon: "fas fa-shopping-cart", color: "orange" },
    [BUNDLE_TYPE_SERVICE]: { title: "Service Flows", icon: "fas fa-concierge-bell", color: "blue" },
    [BUNDLE_TYPE_SYSTEM]: { title: "System Flows", icon: "fas fa-microchip", color: "indigo" },
    [BUNDLE_TYPE_ADMIN]: { title: "Admin Tools", icon: "fas fa-tools", color: "slate" },
    [BUNDLE_TYPE_CLIENT]: { title: "User Clients", icon: "fas fa-mobile-alt", color: "purple" },
    [BUNDLE_TYPE_ENVIRONMENT]: { title: "Environments", icon: "fas fa-globe", color: "emerald" },
    [BUNDLE_TYPE_ATOMIC]: { title: "Atomic Flows", icon: "fas fa-atom", color: "cyan" },
    "component": { title: "Bundle Components", icon: "fas fa-cube", color: "slate" }
};

export const INVITATION_TYPE_REGISTRY = {
    "employee": {
        title: "Fellow Invitation",
        icon: "fas fa-user-plus",
        description: "Invite a person to join as a fellow/employee.",
        emailTemplate: "./bundles/user-services/invitation-admin/templates/email-generic.html",
        autoAdmit: false
    },
    "owner-binding": {
        title: "Licenseholder Binding",
        icon: "fas fa-link",
        description: "Bind a person as the owner/holder of a license.",
        emailTemplate: "./bundles/user-services/invitation-admin/templates/email-owner-binding.html",
        autoAdmit: true
    }
};

