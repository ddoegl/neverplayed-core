export const FLOW_SERVICE = "org.neverplayed.flow.Service";
export const SHELL_COMMAND_SERVICE = "org.neverplayed.shell.Command";
export const SESSION_SERVICE = "org.neverplayed.auth.Session";
export const LOG_SERVICE = "org.neverplayed.LogService";
export const CONFIG_ADMIN_SERVICE = "org.neverplayed.config.Admin";
export const CONFIG_ADMIN_UI_FLOW = "org.neverplayed.config.UIFlow";
export const SYSTEM_RESET_SERVICE = "org.neverplayed.system.Reset";
export const PERSISTENCE_MANAGER_SERVICE = "@pandino/persistence-manager/PersistenceManager";
export const YAML_SERVICE = "org.neverplayed.yaml.YamlService";
export const YAML_EDITOR_SERVICE = "org.neverplayed.yaml.Editor";
export const SELECTION_SERVICE = "org.neverplayed.selection.SelectionService";
export const ACTION_REGISTRY_SERVICE = "org.neverplayed.action.ActionRegistry";
export const AUTH_SHIELD_SERVICE = "org.neverplayed.auth.AuthShield";
export const AUTH_SHIELD_BUNDLE = "org.neverplayed.auth-shield";
export const LIMES_SERVICE = "org.neverplayed.limes.LimesService";
export const LIMES_BUNDLE = "org.neverplayed.limes";
export const LIMES_STRATEGIES_PID = "org.neverplayed.limes.strategies";
export const PERSISTENCE_FIREBASE_BUNDLE = "org.neverplayed.persistence-firebase";
export const PERSISTENCE_FS_SYNC_BUNDLE = "org.neverplayed.persistence-fs-sync";
export const PERSISTENCE_DENO_BUNDLE = "org.neverplayed.persistence-deno";
export const PERSISTENCE_SELECTOR_BUNDLE = "org.neverplayed.persistence-selector";
export const PERSISTENCE_LOCALSTORAGE_BUNDLE = "org.neverplayed.persistence-deno-localstorage";
export const PLEXUS_ENGINE_SERVICE = "org.neverplayed.plexus.Engine";
export const REALM_MANAGER_SERVICE = "org.neverplayed.realm.RealmManager";
export const REALM_SERVICE = "org.neverplayed.realm.RealmService";
export const DOMAIN_OBJECT_REGISTRY_SERVICE = "org.neverplayed.domain.Registry";
export const ACTION_SERVICE = "org.neverplayed.action.ActionService";
export const SHELL_HOST_SERVICE = "org.neverplayed.shell.ShellHost";
export const ATOMIC_COMPONENT_REGISTRY_SERVICE = "org.neverplayed.atomic.ComponentRegistry";
export const UI_COMPONENTS_SERVICE = "org.neverplayed.ui.Components";
export const UI_FACTORY_SERVICE = "org.neverplayed.ui.Factory";
export const PERSISTENCE_RESOLVER_SERVICE = "org.neverplayed.persistence.Resolver";
export const DOMAIN_STRATEGY_SERVICE = "org.neverplayed.domain.Strategy";
export const ATOMIC_SPEC_INGESTION_SERVICE = "org.neverplayed.atomic.SpecIngestion";
export const ENV_SERVICE = "org.neverplayed.system.EnvService";


// Core Domain Services
export const LICENSE_DATA_SERVICE = "org.neverplayed.license.LicenseData";
export const BO_EXTENSION_SERVICE = "org.neverplayed.backoffice.Extension";
export const BO_SESSION_PID = "org.neverplayed.backoffice.session";
export const BACKOFFICE_WEB_FLOW = "org.neverplayed.backoffice.web";
export const CAPABILITIES_DATA_SERVICE = "org.neverplayed.backoffice.capabilities.data";
export const EVALUATOR_SERVICE = "org.neverplayed.backoffice.evaluator";
export const BUSINESS_SESSION_PID = "org.neverplayed.backoffice.business.session";
export const COMPANIES_SERVICE = "org.neverplayed.companies.Service";
export const FEATURE_DATA_SERVICE = "org.neverplayed.features.data";
export const LICENSES_PID = "org.neverplayed.licenses";
export const PERSONS_SERVICE = "org.neverplayed.persons.Service";
export const RETAIL_SESSION_PID = "org.neverplayed.retail.session";
export const PERMISSION_DATA_SERVICE = "org.neverplayed.permissions.data";
export const CASE_MONITOR_FLOW = "org.neverplayed.case.monitor";
export const TENANTS_PID = "org.neverplayed.tenants";
export const SIGNING_DATA_SERVICE = "org.neverplayed.signing.data";
export const COMPANY_REGISTRY_FLOW = "org.neverplayed.company.registry";
export const EMAIL_MONITOR_FLOW = "org.neverplayed.email.monitor";
export const FELLOWS_SERVICE = "org.neverplayed.fellows.Service";
export const MOBILE_LAUNCHER_FLOW = "org.neverplayed.mobile.launcher";
export const PERSON_REGISTRY_FLOW = "org.neverplayed.person.registry";
export const REALLIFE_FLOW = "org.neverplayed.real.life";
export const TENANT_DATA_SERVICE = "org.neverplayed.tenants.data";
export const BUNDLE_TYPE_ORDER = "order";
export const BUNDLE_TYPE_SYSTEM = "system";
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
export const NEVERPLAYED_PREFIX = "org.neverplayed.";
export const ATOMIC_MARKER_HEADER = "X-Atomic-Component";

// Capability Prefixes
export const CAP_SYS = "sys:";
export const CAP_AUTH = "auth:";
export const CAP_BIZ = "biz:";
export const CAP_FLOW = "flow:";

// Event Topics
export const CONFIG_UPDATED_TOPIC = "org/neverplayed/config/UPDATED";
export const REALM_CHANGED_TOPIC = "org/neverplayed/realm/CHANGED";
export const REALM_REGISTERED_TOPIC = "org/neverplayed/realm/REGISTERED";
export const REALM_UNREGISTERED_TOPIC = "org/neverplayed/realm/UNREGISTERED";

// Event Admin Constants
export const EVENT_ADMIN_SERVICE = "@pandino/event-admin/EventAdmin";
export const EVENT_FACTORY_SERVICE = "@pandino/event-admin/EventFactory";
export const EVENT_HANDLER_INTERFACE = "@pandino/event-admin/EventHandler";
export const EVENT_TOPIC = "event.topics";

// Core PIDs & Properties
export const SHELL_CONFIG_PID = "org.neverplayed.shell.cli";
export const SYSTEM_LOGGER_PID = "org.neverplayed.system.logger";
export const LOG_LEVEL_PROP = "log-level";
export const SHELL_CLI_PID = "org.neverplayed.shell.cli";
export const SHELL_CLI_SERVICE = "org.neverplayed.shell.ShellCLI";
export const REALM_STORAGE_PID = "org.neverplayed.realm.storage";
export const EVENT_MONITOR_PID = "org.neverplayed.event.monitor";
export const DO_INSTANCES_PID = "org.neverplayed.do.instances";

// OSGi Bundle States (Numeric and String)
export const BUNDLE_STATE_UNINSTALLED = 1;
export const BUNDLE_STATE_INSTALLED = 2;
export const BUNDLE_STATE_RESOLVED = 4;
export const BUNDLE_STATE_STARTING = 8;
export const BUNDLE_STATE_STOPPING = 16;
export const BUNDLE_STATE_ACTIVE = 32;

// String versions for resilient mapping
export const BUNDLE_STATUS_ACTIVE = "ACTIVE";