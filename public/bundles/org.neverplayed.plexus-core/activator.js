/**
 * @file Activator for org.neverplayed.plexus-core
 * @module platform/bundles/org.neverplayed.plexus-core
 * v2.6.5 - Exposing Evaluator logic as a service to maintain OSGi modularity.
 */

import { PLEXUS_EVALUATOR_SERVICE } from "../../core-types.js";
import { evaluateMatchers, Primitives } from "./evaluator.js";

export default class Activator {
    start(context) {
        // Register the Evaluator logic as an OSGi Service
        context.registerService(PLEXUS_EVALUATOR_SERVICE, {
            evaluateMatchers,
            Primitives
        }, {
            "capability": "sys:logic",
            "implementation": "plexus-core-evaluator"
        });
    }

    stop(_context) {
        // No-op
    }
}
