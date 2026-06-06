/**
 * Domain Service Types
 * Specific application domain constants and bundle typings.
 */

// 1. Core Domain Services (Backoffice & Infrastructure Data)
export const RULES_DATA_SERVICE = "org.neverplayed.backoffice/rules/data";
export const BIZ_FUNC_DATA_SERVICE = "org.neverplayed.backoffice/business/functions";
export const CAPABILITIES_DATA_SERVICE = "org.neverplayed.backoffice/capabilities/data";
export const PERMISSION_DATA_SERVICE = "org.neverplayed.backoffice/permissions/data";
export const FEATURE_DATA_SERVICE = "org.neverplayed.backoffice/features/data";
export const LICENSE_DATA_SERVICE = "org.neverplayed.backoffice/licenses/data";
export const COMPANIES_SERVICE = "org.neverplayed.infrastructure/companies/data";
export const PERSONS_SERVICE = "org.neverplayed.infrastructure/persons/data";
export const TENANT_DATA_SERVICE = "org.neverplayed.backoffice/data/tenants";
export const TOPICS_DATA_SERVICE = "org.neverplayed.backoffice/topics/data";
export const CAMPAIGNS_SERVICE = "org.neverplayed.backoffice/campaigns/data";
export const SIGNING_DATA_SERVICE = "org.neverplayed.backoffice/signing/data";
export const FELLOWS_SERVICE = "org.neverplayed.backoffice/fellows/data";
export const SYSTEM_READY_SERVICE = "org.neverplayed.system.ready";
export const BO_EXTENSION_SERVICE = "org.neverplayed.backoffice/extension";
export const EVALUATOR_SERVICE = "org.neverplayed.backoffice.evaluator";

// 2. Domain PIDs
export const RULES_PID = "org.neverplayed.backoffice/rules";
export const CAPABILITIES_PID = "org.neverplayed.backoffice/capabilities";
export const PERMISSIONS_PID = "org.neverplayed.backoffice/permissions";
export const FEATURES_PID = "org.neverplayed.backoffice/features";
export const BIZ_FUNCS_PID = "org.neverplayed.backoffice/business-functions";
export const LICENSES_PID = "org.neverplayed.backoffice/licenses";
export const COMPANIES_PID = "org.neverplayed.infrastructure/companies";
export const PERSONS_PID = "org.neverplayed.infrastructure/persons";
export const TENANTS_PID = "org.neverplayed.backoffice/tenants";
export const BO_SESSION_PID = "org.neverplayed.backoffice.session";
export const BUSINESS_SESSION_PID = "org.neverplayed.backoffice.business.session";
export const RETAIL_SESSION_PID = "org.neverplayed.retail.session";

// 3. Application Flows
export const BACKOFFICE_WEB_FLOW = "org.neverplayed.backoffice.web";
export const CASE_MONITOR_FLOW = "org.neverplayed.case.monitor";
export const COMPANY_REGISTRY_FLOW = "org.neverplayed.company.registry";
export const EMAIL_MONITOR_FLOW = "org.neverplayed.email.monitor";
export const MOBILE_LAUNCHER_FLOW = "org.neverplayed.mobile.launcher";
export const PERSON_REGISTRY_FLOW = "org.neverplayed.person.registry";
export const REALLIFE_FLOW = "org.neverplayed.real.life";
export const BOOTSTRAP_LICENSE_FLOW = "bootstrap-license";

// 4. Placeholder for Domain-specific Logic
// Only purely application-specific constants should remain here.
export const GYM_MACHINE_REGISTRY_SERVICE = "org.neverplayed.gym.MachineRegistry";
export const SOMATIC_MUSCLE_REGISTRY_SERVICE = "org.neverplayed.somatic.MuscleRegistry";
export const REALM_GEMMA = "org.neverplayed.realm.gemma";
export const REALM_SOMATIC_BODY = "org.neverplayed.realm.somatic-body";
export const REALM_GYM = "org.neverplayed.realm.gym";
export const LLM_SERVICE = "org.neverplayed.LLMService";

