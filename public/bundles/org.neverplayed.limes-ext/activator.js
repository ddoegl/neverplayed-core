/**
 * @file Activator for org.neverplayed.limes-ext
 * @module platform/bundles/org.neverplayed.limes-ext
 */

import { LIMES_SERVICE } from "core-types";

export default class Activator {
    start(context) {
        context.trackService(`(objectClass=${LIMES_SERVICE})`, {
            addingService: (ref) => {
                const limes = context.getService(ref);
                const legacyStrategies = [
                    {
                        id: "DO_VIEW",
                        operator: "OR",
                        matchers: [
                            { type: "matchScopeIntersection", permission: "DO_VIEW_ALLOWED", property: "owner" },
                            { type: "matchPermission", value: "DO_VIEW_ALLOWED" }
                        ]
                    },
                    {
                        id: "DO_SIGN",
                        operator: "OR",
                        matchers: [
                            { type: "matchScopeIntersection", permission: "DO_SIGN_ALLOWED", property: "owner" },
                            { type: "matchPermission", value: "DO_SIGN_ALLOWED" }
                        ]
                    },
                    {
                        id: "DO_TRADE",
                        operator: "OR",
                        matchers: [
                            { type: "matchScopeIntersection", permission: "DO_TRADE_ALLOWED", property: "owner" },
                            { type: "matchPermission", value: "DO_TRADE_ALLOWED" }
                        ]
                    },
                    {
                        id: "DO_EDIT",
                        operator: "OR",
                        matchers: [{ type: "matchAlways", value: true }]
                    },
                    {
                        id: "DO_DELETE",
                        operator: "OR",
                        matchers: [{ type: "matchAlways", value: true }]
                    }
                ];

                legacyStrategies.forEach(s => limes.registerStrategy(s.id, s));
            }
        }).open();
    }

    stop(_context) {}
}
