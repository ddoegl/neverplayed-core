import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as PathResolver from "../utils/path-resolver.js";

Deno.test("PathResolver: Non-Destructive Interpolation (ADR-0026 Regression)", () => {
    const scope = {
        uifValues: {
            userName: "Daniela"
        }
    };

    // 1. Simple Resolution
    assertEquals(
        PathResolver.interpolate("Hello ${this.userName}", scope), 
        "Hello Daniela",
        "Should resolve simple state variables"
    );

    // 2. Missing Variable Preservation (The Regression Fix)
    assertEquals(
        PathResolver.interpolate("Value is ${missing}", scope), 
        "Value is ${missing}",
        "Should preserve markers for missing variables to allow multi-pass resolution"
    );

    // 3. Multi-pass Simulation (Action Parameters)
    const pass1 = PathResolver.interpolate("Endpoint: /users/${userId}", scope);
    assertEquals(pass1, "Endpoint: /users/${userId}", "Pass 1 should preserve userId");
    
    const extra = { userId: "7" };
    const pass2 = PathResolver.interpolate(pass1, scope, extra);
    assertEquals(pass2, "Endpoint: /users/7", "Pass 2 should resolve preserved marker from extra params");
});

Deno.test("PathResolver: Deep Value Resolution", () => {
    const scope = {
        uifValues: {
            user: {
                profile: {
                    displayName: "Speckit"
                }
            }
        }
    };

    assertEquals(
        PathResolver.interpolate("Hi ${this.user.profile.displayName}", scope), 
        "Hi Speckit",
        "Should resolve deep nested paths"
    );
});
