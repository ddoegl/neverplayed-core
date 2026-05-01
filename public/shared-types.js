// shared-types.js
export const FLOW_SERVICE = "org.neverplayed.flow-service";
export const SESSION_SERVICE = "org.neverplayed.session-service";
export const NAV_SERVICE = "org.neverplayed.nav-service";
export const SHELL_HOST_SERVICE = "org.neverplayed.shell-host-service";
export const YAML_SERVICE = "org.neverplayed.yaml-service";
export const NEVERPLAYED_PREFIX = "org.neverplayed.";
export const SYSTEM_RESET_SERVICE = "org.neverplayed.system-reset/SystemReset";
export const LOG_SERVICE = "org.neverplayed.LogService";
export const CONFIG_ADMIN_SERVICE = "org.neverplayed.config-admin/ConfigAdmin";
export const PERSISTENCE_FIREBASE_BUNDLE = "org.neverplayed.persistence-firebase";
export const CONFIG_ADMIN_UI_FLOW = "org.neverplayed.config-admin-ui";
export const REALLIFE_FLOW = "real-life";
export const MOBILE_LAUNCHER_FLOW = "mobile-launcher";
export const SHELL_CLI_PID = "org.neverplayed.shell-cli";
export const SHELL_CLI_SERVICE = "org.neverplayed.shell-cli/service";
export const COMPANY_REGISTRY_FLOW = "company-registry";
export const PERSON_REGISTRY_FLOW = "org.neverplayed.person.registry";
export const BACKOFFICE_WEB_FLOW = "backoffice-web";
export const EMAIL_MONITOR_FLOW = "email-provider-ui";
export const CASE_MONITOR_FLOW = "case-monitor";
export const BO_EXTENSION_SERVICE = "org.neverplayed.backoffice/extension";
export const YAML_EDITOR_SERVICE = "org.neverplayed.yaml-editor/service";
export const ENV_SERVICE = "org.neverplayed.env-service";
export const SYSTEM_READY_SERVICE = "org.neverplayed.system-ready";
export const SELECTION_SERVICE = "org.neverplayed.selection-service";
export const LICENSE_DATA_SERVICE = "org.neverplayed.backoffice/licenses/data";
export const FELLOWS_SERVICE = "org.neverplayed.backoffice/fellows/data";
export const INVITATION_SERVICE = "org.neverplayed.backoffice/invitations/data";
export const TENANT_DATA_SERVICE = "org.neverplayed.backoffice/data/tenants";
export const EMAIL_SERVICE = "org.neverplayed.email-service";
export const PERSONS_SERVICE = "org.neverplayed.infrastructure/persons/data";
export const COMPANIES_SERVICE = "org.neverplayed.infrastructure/companies/data";
export const CASE_SERVICE = "org.neverplayed.backoffice/cases/data";
export const BPMN_ENGINE_SERVICE = "org.neverplayed.bpmn/engine";
export const SIGNING_DATA_SERVICE = "org.neverplayed.backoffice/signing/data";
export const RULES_DATA_SERVICE = "org.neverplayed.backoffice/rules/data";
export const BIZ_FUNC_DATA_SERVICE = "org.neverplayed.backoffice/business/functions";
export const CAPABILITIES_DATA_SERVICE = "org.neverplayed.backoffice/capabilities/data";
export const PERMISSION_DATA_SERVICE = "org.neverplayed.backoffice/permissions/data";
export const FEATURE_DATA_SERVICE = "org.neverplayed.backoffice/features/data";
export const PLEXUS_ENGINE_SERVICE = "org.neverplayed.plexus/engine";
export const PLEXUS_TRACING_UI = "org.neverplayed.plexus/tracing/ui";
export const LIMES_SERVICE = "org.neverplayed.limes.LimesService";
export const DOMAIN_OBJECT_REGISTRY_SERVICE = "org.neverplayed.domain.Registry";
export const DOMAIN_OBJECT_INSTANCE_SERVICE = "org.neverplayed.domain.Instance";
export const DOMAIN_STRATEGY_SERVICE = "org.neverplayed.domain.Strategy";
export const EVENT_ADMIN_SERVICE = "@pandino/event-admin/EventAdmin";
export const EVENT_FACTORY_SERVICE = "@pandino/event-admin/EventFactory";
export const EVENT_HANDLER_INTERFACE = "@pandino/event-admin/EventHandler";
export const EVENT_TOPIC = "event.topics";
export const ACTION_REGISTRY_SERVICE = "org.neverplayed.action.ActionRegistry";
export const ACTION_SERVICE = "org.neverplayed.action.ActionService";
export const UI_FACTORY_SERVICE = "org.neverplayed.ui.Factory";
export const UI_COMPONENTS_SERVICE = "org.neverplayed.ui.Components";
export const CASE_ADDED_TOPIC = "org/neverplayed/case/ADDED";
export const CASE_UPDATED_TOPIC = "org/neverplayed/case/UPDATED";
export const TOPICS_DATA_SERVICE = "org.neverplayed.backoffice/topics/data";
export const EVALUATOR_SERVICE = "org.neverplayed.backoffice.evaluator";
export const CAMPAIGNS_SERVICE = "org.neverplayed.backoffice/campaigns/data";
export const EVAL_DATA_SERVICE = "org.neverplayed.backoffice/evaluator/data";
export const SCA_DATA_SERVICE = "org.neverplayed.backoffice/sca/data";
export const SCA_METHODS_SERVICE = "org.neverplayed.backoffice/sca/methods";
export const EMAIL_DATA_SERVICE = "org.neverplayed.backoffice/email/data";
export const TERMINAL_STATE_SERVICE = "org.neverplayed.backoffice/terminal/state";
//export const REALM_MANAGER_SERVICE = "org.neverplayed.realm-manager/service";
export const REALM_SERVICE = "org.neverplayed.realm/service";
export const PERSISTENCE_RESOLVER_SERVICE = "org.neverplayed.persistence/resolver";
export const SHELL_COMMAND_SERVICE = "org.neverplayed.shell-command-service";
export const REALM_STORAGE_PID = "realm.active";

// Config PIDs
export const REALM_CONFIG_PID = "org.neverplayed.realm-manager";
/** @deprecated Logic must not be persisted as Data (Firestore). Use DOMAIN_STRATEGY_SERVICE tracking instead. */
export const DO_STRATEGIES_PID = "org.neverplayed.backoffice/do/strategies";
export const DO_INSTANCES_PID = "org.neverplayed.backoffice/do/instances";
export const SHELL_CONFIG_PID = "org.neverplayed.shell-cli";
export const LIMES_STRATEGIES_PID = "org.neverplayed.limes/strategies";
export const CASES_PID = "org.neverplayed.backoffice/cases/data";
export const SIGNING_STRATEGIES_PID = "org.neverplayed.backoffice/signing/strategies";
export const SIGNING_CASE_TYPES_PID = "org.neverplayed.backoffice/signing/case-types";
export const SCA_STRATEGIES_PID = "org.neverplayed.backoffice/sca/strategies";
export const INVITATIONS_PID = "org.neverplayed.backoffice/invitations";
export const SCA_METHODS_PID = "org.neverplayed.backoffice/sca/methods";
export const TOPICS_PID = "org.neverplayed.backoffice/topics";
export const TOPIC_STRATEGIES_PID = "org.neverplayed.backoffice/topic-strategies";
export const BIZ_FUNCS_PID = "org.neverplayed.backoffice/business-functions";
export const CAMPAIGNS_PID = "org.neverplayed.backoffice/campaigns";
export const CAMPAIGN_STRATEGIES_PID = "org.neverplayed.backoffice/strategies";
export const EVENT_MONITOR_PID = "org.neverplayed.event-monitor";
export const SYSTEM_LOGGER_PID = "org.neverplayed.system-logger";
export const PLEXUS_PID = "org.neverplayed.plexus/engine";
export const TENANTS_PID = "org.neverplayed.backoffice/tenants";
export const LICENSES_PID = "org.neverplayed.backoffice/licenses";
export const RULES_PID = "org.neverplayed.backoffice/rules";
export const CAPABILITIES_PID = "org.neverplayed.backoffice/capabilities";
export const PERMISSIONS_PID = "org.neverplayed.backoffice/permissions";
export const FEATURES_PID = "org.neverplayed.backoffice/features";
export const PERSONS_PID = "org.neverplayed.infrastructure/persons";
export const COMPANIES_PID = "org.neverplayed.infrastructure/companies";
export const FELLOWS_PID = "org.neverplayed.backoffice/fellows";
export const EMAIL_DATA_PID = "org.neverplayed.backoffice/email/data";
export const BO_SESSION_PID = "org.neverplayed.backoffice-session";
export const BUSINESS_SESSION_PID = "org.neverplayed.business-session";
export const RETAIL_SESSION_PID = "org.neverplayed.retail-session";
export const LOG_LEVEL_PROP = "log-level";

// Bundle Types for Governance
export const BUNDLE_TYPE_ORDER = "order-flow";
export const BUNDLE_TYPE_SERVICE = "service-flow";
export const BUNDLE_TYPE_SYSTEM = "system-flow";
export const BUNDLE_TYPE_ADMIN = "admin-flow";
export const BUNDLE_TYPE_CLIENT = "client-flow";
export const BUNDLE_TYPE_ENVIRONMENT = "environment-flow";
export const BUNDLE_TYPE_ATOMIC = "atomic-flow";
export const ATOMIC_SPEC_INGESTION_SERVICE = "org.neverplayed.atomic/ingestion";
export const ATOMIC_COMPONENT_REGISTRY_SERVICE = "org.neverplayed.atomic/component/registry";
export const ATOMIC_MARKER_HEADER = "X-Atomic-Bundle";

export const ATOMIC_BUNDLE_SERVICE = "org.neverplayed.atomic/bundle";

// No changes needed here, just removing the old SHELL_CONFIG_PID if it was there
 
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

