/**
 * Platform Core Types
 * Fundamental OSGi and Shell Infrastructure constants.
 */

// 1. Core Shell Services
export const FLOW_SERVICE = "org.neverplayed.flow.FlowService";
export const SHELL_COMMAND_SERVICE = "org.neverplayed.shell.Command";
export const SESSION_SERVICE = "org.neverplayed.auth.Session";
export const LOG_SERVICE = "org.neverplayed.LogService";
export const CONFIG_ADMIN_SERVICE = "org.neverplayed.config.Admin";
export const CONFIG_ADMIN_UI_FLOW = "org.neverplayed.config.UIFlow";
export const SYSTEM_RESET_SERVICE = "org.neverplayed.system.Reset";
export const AGENT_SERVICE = "org.neverplayed.agent.AgentService";
export const STRATUM_SERVICE = "org.neverplayed.stratum.StratumService";
export const BEING_SERVICE = "org.neverplayed.domain.BeingService";

// 2. Pandino / External Services
export const PERSISTENCE_MANAGER_SERVICE = "@pandino/persistence-manager/PersistenceManager";
export const EVENT_ADMIN_SERVICE = "@pandino/event-admin/EventAdmin";
export const EVENT_FACTORY_SERVICE = "@pandino/event-admin/EventFactory";
export const EVENT_HANDLER_INTERFACE = "@pandino/event-admin/EventHandler";
export const EVENT_TOPIC = "event.topics";

// 3. Infrastructure Services
export const REALM_MANAGER_SERVICE = "org.neverplayed.realm.RealmManager";
export const REALM_SERVICE = "org.neverplayed.realm.RealmService";
export const SHELL_HOST_SERVICE = "org.neverplayed.shell.ShellHost";
export const SHELL_CLI_SERVICE = "org.neverplayed.shell.ShellCLI";
export const AUTH_SHIELD_SERVICE = "org.neverplayed.auth.AuthShield";
export const LIMES_SERVICE = "org.neverplayed.limes.LimesService";
export const YAML_SERVICE = "org.neverplayed.yaml.YamlService";
export const YAML_EDITOR_SERVICE = "org.neverplayed.yaml.Editor";
export const ENV_SERVICE = "org.neverplayed.system.EnvService";
export const PERSISTENCE_RESOLVER_SERVICE = "org.neverplayed.persistence.Resolver";

// 4. Persistence & PIDs
export const SHELL_CONFIG_PID = "org.neverplayed.shell.cli";
export const SHELL_CLI_PID = "org.neverplayed.shell.cli";
export const SYSTEM_LOGGER_PID = "org.neverplayed.system.logger";
export const REALM_STORAGE_PID = "org.neverplayed.realm.storage";
export const SHELL_UI_CONTEXT_PID = "org.neverplayed.shell.ui.context";
export const EVENT_MONITOR_PID = "org.neverplayed.event.monitor";
export const DO_INSTANCES_PID = "realm.do.instances";
export const DO_INSTANCES_LEGACY_PID = "org.neverplayed.do.instances";
export const LIMES_STRATEGIES_PID = "org.neverplayed.limes.strategies";
export const AGENT_ANTIGRAVITY_PID = "org.neverplayed.agent.antigravity";
export const LOG_LEVEL_PROP = "log-level";

// 5. Realm IDs
export const REALM_CORE = "org.neverplayed.realm.core";
export const REALM_FOUNDATION = "org.neverplayed.realm.foundation";
export const REALM_SHOWCASE = "org.neverplayed.realm.showcase";
export const REALM_HABITAT = "org.neverplayed.realm.habitat";
export const REALM_GOVERNANCE = "org.neverplayed.realm.governance";

// 6. Lifecycle & Messaging
export const CONFIG_UPDATED_TOPIC = "org/neverplayed/config/UPDATED";
export const REALM_CHANGED_TOPIC = "org/neverplayed/realm/CHANGED";
export const REALM_REGISTERED_TOPIC = "org/neverplayed/realm/REGISTERED";
export const REALM_UNREGISTERED_TOPIC = "org/neverplayed/realm/UNREGISTERED";
export const AGENT_AUDIT_COMPLETED_TOPIC = "org/neverplayed/agent/AUDIT_COMPLETED";

// 6. OSGi Bundle States
export const BUNDLE_STATE_UNINSTALLED = 1;
export const BUNDLE_STATE_INSTALLED = 2;
export const BUNDLE_STATE_RESOLVED = 4;
export const BUNDLE_STATE_STARTING = 8;
export const BUNDLE_STATE_STOPPING = 16;
export const BUNDLE_STATE_ACTIVE = 32;
export const BUNDLE_STATUS_ACTIVE = "ACTIVE";

// 7. Generic Selection & Registry
export const SELECTION_SERVICE = "org.neverplayed.selection.SelectionService";
export const ACTION_REGISTRY_SERVICE = "org.neverplayed.action.ActionRegistry";
export const ACTION_SERVICE = "org.neverplayed.action.ActionService";
export const PLEXUS_ENGINE_SERVICE = "org.neverplayed.plexus.Engine";
export const PLEXUS_TRACING_UI = "org.neverplayed.plexus.TracingUI";
export const PLEXUS_SENSOR_SERVICE = "org.neverplayed.plexus.Sensor";
export const PLEXUS_PID = "org.neverplayed.plexus.engine";
export const PLEXUS_KNOWLEDGE_PROVIDER = "org.neverplayed.plexus.KnowledgeProvider";
export const DOMAIN_OBJECT_REGISTRY_SERVICE = "org.neverplayed.domain.Registry";
export const DOMAIN_OBJECT_INSTANCE_SERVICE = "org.neverplayed.domain.Instance";
export const DOMAIN_STRATEGY_SERVICE = "org.neverplayed.domain.Strategy";
export const ATOMIC_COMPONENT_REGISTRY_SERVICE = "org.neverplayed.atomic.ComponentRegistry";
export const ATOMIC_SPEC_INGESTION_SERVICE = "org.neverplayed.atomic.SpecIngestion";
export const UI_COMPONENTS_SERVICE = "org.neverplayed.ui.Components";
export const UI_FACTORY_SERVICE = "org.neverplayed.ui.Factory";
export const UI_REGISTRY_SERVICE = "org.neverplayed.ui.Registry";
export const CONTRIBUTION_SERVICE = "org.neverplayed.global-state.ContributionService";
export const INTERACTOR_SERVICE = "org.neverplayed.ui.Interactor";

// 8. Bundle Typings
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

export const PLATFORM_SHOWCASE_FLOW = "platform-showcase";
export const DOMAIN_OBJECTS_FLOW = "domain-objects";
export const WEB_SPRINGBOARD_FLOW = "web-springboard";

export const NEVERPLAYED_PREFIX = "org.neverplayed.";
export const ATOMIC_MARKER_HEADER = "X-Atomic-Bundle";

// 9. Core Capabilities
export const CAP_SYS = "sys:";
export const CAP_AUTH = "auth:";
export const CAP_FLOW = "flow:";
export const CAP_BIZ = "biz:";
