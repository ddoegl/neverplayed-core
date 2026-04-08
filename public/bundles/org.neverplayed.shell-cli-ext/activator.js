/**
 * @file Activator for org.neverplayed.shell-cli-ext
 * @module platform/bundles/org.neverplayed.shell-cli-ext
 */

import { 
    SESSION_SERVICE, 
    SELECTION_SERVICE, 
    SHELL_COMMAND_SERVICE 
} from "core-types";
import { BaseActivator } from "osgi-base";
import { sendInvitationRequest } from "../../auth-shield.js";

export default class Activator extends BaseActivator {
    onStart(context) {
        // /invite command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "invite",
            description: "[email] - Send fellowship invitation",
            execute: async (args, _ctx, log) => {
                const email = args[0];
                if (!email) {
                    log("Usage: /invite [email]", "error");
                    return;
                }
                log(`Sending invitation to: ${email}...`);
                try {
                    await sendInvitationRequest(email);
                    log(`Success: Invitation sent to ${email}`);
                } catch (err) {
                    log(`Failed to send invitation: ${err.message}`, "error");
                }
            }
        });

        // /whoami command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "whoami",
            description: "Show current session info",
            execute: (_args, ctx, log) => {
                const sessionRef = ctx.getServiceReference(SESSION_SERVICE);
                const session = sessionRef ? ctx.getService(sessionRef) : null;
                const user = session?.currentUser;
                if (user) {
                    const alias = user.alias || user.email || user.firstname;
                    log(`Active User: ${alias} (ID: ${user.id})`);
                } else {
                    log("No active session found.", "error");
                }
            }
        });

        // /vars command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "vars",
            description: "[category] [id] - List and drill down flow variables",
            execute: (args, ctx, log) => {
                const boState = globalThis.backofficeState;
                if (!boState) {
                    log("Backoffice state not found.", "error");
                    return;
                }

                const categoryArg = args[0];
                const targetArg = args[1]; 

                const categories = {
                    people: { data: boState.persons, label: "Persons" },
                    companies: { data: boState.companies, label: "Companies" },
                    cases: { data: boState.parsedDOInstances?.['backoffice-cases'] || [], label: "Cases" },
                    caseTypes: { data: boState.parsedCaseTypes || [], label: "Case Types" },
                    licenses: { data: boState.parsedLicenses?.LICENSES || [], label: "Licenses" },
                    selection: { 
                        data: ctx.getService(ctx.getServiceReference(SELECTION_SERVICE)) || {}, 
                        label: "Current Selection"
                    }
                };

                if (!categoryArg) {
                    log("Variable Categories:");
                    Object.keys(categories).forEach(cat => {
                        log(` - ${cat} (${categories[cat].data?.length || 0} items)`);
                    });
                    return;
                }

                let items = categories[categoryArg.toLowerCase()]?.data;
                let label = categories[categoryArg.toLowerCase()]?.label || categoryArg;

                if (items === undefined) {
                    const ref = ctx.getServiceReference(categoryArg);
                    if (ref) {
                        const svc = ctx.getService(ref);
                        items = [svc];
                        label = `Service: ${categoryArg}`;
                    }
                }

                if (items === undefined) {
                    log(`No data source found for: ${categoryArg}`, "error");
                    return;
                }

                if (!targetArg) {
                    log(`${label}:`);
                    log(items);
                    return;
                }

                const [id, ...pathParts] = targetArg.split('.');
                const path = pathParts.join('.');
                const item = Array.isArray(items) ? items.find(i => String(i.id) === String(id)) : items;

                if (!item) {
                    log(`Item not found: ${id}`, "error");
                    return;
                }

                let result = item;
                if (path) {
                    result = path.split('.').reduce((obj, p) => obj?.[p], item);
                }

                log(`Inspect: ${label} / ${targetArg}`);
                log(result);
            }
        });
    }

    stop() {}
}
