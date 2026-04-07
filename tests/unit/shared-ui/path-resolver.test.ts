import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveValue, interpolate } from "../../../public/bundles/org.neverplayed.shared-ui/utils/path-resolver.js";

Deno.test("PathResolver: resolveValue - simple path", () => {
    const scope = { uifValues: { name: "Antigravity" } };
    assertStrictEquals(resolveValue("name", scope), "Antigravity");
});

Deno.test("PathResolver: resolveValue - deep path", () => {
    const scope = { 
        uifValues: { 
            user: { profile: { name: "Alice" } } 
        } 
    };
    assertStrictEquals(resolveValue("user.profile.name", scope), "Alice");
});

Deno.test("PathResolver: resolveValue - with this. prefix", () => {
    const scope = { uifValues: { city: "Berlin" } };
    assertStrictEquals(resolveValue("this.city", scope), "Berlin");
});

Deno.test("PathResolver: resolveValue - with uifValues. prefix", () => {
    const scope = { uifValues: { country: "Germany" } };
    assertStrictEquals(resolveValue("uifValues.country", scope), "Germany");
});

Deno.test("PathResolver: resolveValue - with explicit expression ${path}", () => {
    const scope = { uifValues: { version: "1.0.0" } };
    assertStrictEquals(resolveValue("${version}", scope), "1.0.0");
});

Deno.test("PathResolver: interpolate - simple string", () => {
    const scope = { uifValues: { name: "Antigravity" } };
    assertStrictEquals(interpolate("Hello ${name}", scope), "Hello Antigravity");
});

Deno.test("PathResolver: interpolate - multiple placeholders", () => {
    const scope = { uifValues: { name: "Antigravity", role: "AI" } };
    assertStrictEquals(interpolate("${name} is an ${role}", scope), "Antigravity is an AI");
});

Deno.test("PathResolver: interpolate - deep paths", () => {
    const scope = { 
        uifValues: { 
            user: { firstName: "Jane" } 
        } 
    };
    assertStrictEquals(interpolate("Welcome ${user.firstName}", scope), "Welcome Jane");
});

Deno.test("PathResolver: interpolate - fallback to empty string", () => {
    const scope = { uifValues: {} };
    assertStrictEquals(interpolate("Hello ${missing}", scope), "Hello ");
});

Deno.test("PathResolver: resolveValue - raw path (no brackets)", () => {
    const scope = { uifValues: { userId: "user-123" } };
    assertStrictEquals(resolveValue("userId", scope), "user-123");
});

Deno.test("PathResolver: resolveValue - prefixed raw path", () => {
    const scope = { uifValues: { licenseId: "lic-456" } };
    assertStrictEquals(resolveValue("uifValues.licenseId", scope), "lic-456");
});

Deno.test("PathResolver: resolveValue - deep raw path", () => {
    const scope = { uifValues: { app: { version: "2.0" } } };
    assertStrictEquals(resolveValue("app.version", scope), "2.0");
});
