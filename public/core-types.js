export const FLOW_SERVICE = "@neverplayed/flow-service";
export const SHELL_COMMAND_SERVICE = "@neverplayed/shell-command-service";
export const SESSION_SERVICE = "@neverplayed/session-service";
export const LOG_SERVICE = "@neverplayed/LogService";
export const CONFIG_ADMIN_SERVICE = "@neverplayed/config-admin/ConfigAdmin";
export const CONFIG_ADMIN_UI_FLOW = "@neverplayed/config-admin/ui-flow";
export const SYSTEM_RESET_SERVICE = "@neverplayed/system-reset/SystemReset";
export const PERSISTENCE_MANAGER_SERVICE = "@pandino/persistence-manager/PersistenceManager";
export const YAML_SERVICE = "@neverplayed/yaml-service";
export const YAML_EDITOR_SERVICE = "@neverplayed/yaml-editor/service";
export const SELECTION_SERVICE = "@neverplayed/selection-service";
export const ACTION_REGISTRY_SERVICE = "@neverplayed/action-registry";
export const AUTH_SHIELD_SERVICE = "@neverplayed/auth-shield/service";
export const AUTH_SHIELD_BUNDLE = "@neverplayed/auth-shield";
export const LIMES_SERVICE = "@neverplayed/limes/service";
export const LIMES_BUNDLE = "@neverplayed/limes";
export const LIMES_STRATEGIES_PID = "@neverplayed/limes/strategies";
export const PERSISTENCE_FIREBASE_BUNDLE = "@neverplayed/persistence-firebase";
export const PERSISTENCE_FS_SYNC_BUNDLE = "@neverplayed/persistence-fs-sync";
export const PERSISTENCE_DENO_BUNDLE = "@neverplayed/persistence-deno";
export const PERSISTENCE_SELECTOR_BUNDLE = "@neverplayed/persistence-selector";
export const PERSISTENCE_LOCALSTORAGE_BUNDLE = "@neverplayed/persistence-deno-localstorage";
export const PLEXUS_ENGINE_SERVICE = "@neverplayed/plexus/engine";
export const REALM_MANAGER_SERVICE = "@neverplayed/realm-manager/service";
export const REALM_SERVICE = "@neverplayed/realm/service";
export const DOMAIN_OBJECT_REGISTRY_SERVICE = "@neverplayed/domain-object-registry/service";
export const ACTION_SERVICE = "@neverplayed/action-service";
export const SHELL_HOST_SERVICE = "@neverplayed/shell-host/service";
export const ATOMIC_COMPONENT_REGISTRY_SERVICE = "@neverplayed/atomic-component-registry/service";
export const UI_COMPONENTS_SERVICE = "@neverplayed/ui-components/service";
export const UI_FACTORY_SERVICE = "@neverplayed/ui-factory/service";
export const PERSISTENCE_RESOLVER_SERVICE = "@neverplayed/persistence-resolver/service";
export const DOMAIN_STRATEGY_SERVICE = "@neverplayed/domain-strategy/service";
export const ATOMIC_SPEC_INGESTION_SERVICE = "@neverplayed/atomic-spec-ingestion/service";
export const ENV_SERVICE = "@neverplayed/env-service";


//questionable
export const LICENSE_DATA_SERVICE = "@neverplayed/license-data/service";
export const BO_EXTENSION_SERVICE = "@neverplayed/backoffice/extension";
export const BO_SESSION_PID = "@neverplayed/backoffice/session";
export const BACKOFFICE_WEB_FLOW = "@neverplayed/backoffice/web";
export const CAPABILITIES_DATA_SERVICE = "@neverplayed/backoffice/capabilities/data";
export const EVALUATOR_SERVICE = "@neverplayed/backoffice/evaluator";
export const BUSINESS_SESSION_PID = "@neverplayed/backoffice/business-session";
export const BUNDLE_TYPE_ORDER = "order";
export const COMPANIES_SERVICE = "@neverplayed/companies/service";
export const FEATURE_DATA_SERVICE = "@neverplayed/features/data";
export const BUNDLE_TYPE_SYSTEM = "system";
export const LICENSES_PID = "@neverplayed/licenses";
export const PERSONS_SERVICE = "@neverplayed/persons/service";
export const RETAIL_SESSION_PID = "@neverplayed/retail-session";
export const PERMISSION_DATA_SERVICE = "@neverplayed/permissions/data";
export const CASE_MONITOR_FLOW = "@neverplayed/case-monitor";
export const TENANTS_PID = "@neverplayed/tenants";
export const SIGNING_DATA_SERVICE = "@neverplayed/signing/data";
export const COMPANY_REGISTRY_FLOW = "@neverplayed/company-registry";
export const EMAIL_MONITOR_FLOW = "@neverplayed/email-monitor";
export const FELLOWS_SERVICE = "@neverplayed/fellows/service";
export const MOBILE_LAUNCHER_FLOW = "@neverplayed/mobile-launcher";
export const PERSON_REGISTRY_FLOW = "@neverplayed/person-registry";
export const REALLIFE_FLOW = "@neverplayed/real-life";
export const TENANT_DATA_SERVICE = "@neverplayed/tenants/data";
export const BUNDLE_TYPE_ADMIN = "admin-flow";
export const BUNDLE_TYPE_SERVICE = "service-flow";
export const BUNDLE_TYPE_CLIENT = "client-flow";
export const BUNDLE_TYPE_ENVIRONMENT = "environment-flow";
export const BUNDLE_TYPE_ATOMIC = "atomic-flow";
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
export const NEVERPLAYED_PREFIX = "@neverplayed/";
export const ATOMIC_MARKER_HEADER = "X-Atomic-Component";

// Capability Prefixes
export const CAP_SYS = "sys:";
export const CAP_AUTH = "auth:";
export const CAP_BIZ = "biz:";
export const CAP_FLOW = "flow:";

// Event Topics
export const CONFIG_UPDATED_TOPIC = "org/neverplayed/config/UPDATED";
export const REALM_CHANGED_TOPIC = "neverplayed/realm/CHANGED";
export const REALM_REGISTERED_TOPIC = "neverplayed/realm/REGISTERED";
export const REALM_UNREGISTERED_TOPIC = "neverplayed/realm/UNREGISTERED";

// Event Admin Constants
export const EVENT_ADMIN_SERVICE = "@pandino/event-admin/EventAdmin";
export const EVENT_FACTORY_SERVICE = "@pandino/event-admin/EventFactory";
export const EVENT_HANDLER_INTERFACE = "@pandino/event-admin/EventHandler";
export const EVENT_TOPIC = "event.topics";

// Core PIDs & Properties
export const SHELL_CONFIG_PID = "@neverplayed/shell-cli";
export const SYSTEM_LOGGER_PID = "@neverplayed/system-logger";
export const LOG_LEVEL_PROP = "log-level";
export const SHELL_CLI_PID = "@neverplayed/shell-cli";
export const SHELL_CLI_SERVICE = "@neverplayed/shell-cli/service";
export const REALM_STORAGE_PID = "@neverplayed/realm-storage";
export const EVENT_MONITOR_PID = "@neverplayed/event-monitor";
export const DO_INSTANCES_PID = "@neverplayed/do-instances";

// OSGi Bundle States (Numeric and String)
export const BUNDLE_STATE_UNINSTALLED = 1;
export const BUNDLE_STATE_INSTALLED = 2;
export const BUNDLE_STATE_RESOLVED = 4;
export const BUNDLE_STATE_STARTING = 8;
export const BUNDLE_STATE_STOPPING = 16;
export const BUNDLE_STATE_ACTIVE = 32;

// String versions for resilient mapping
export const BUNDLE_STATUS_ACTIVE = "ACTIVE";