/**
 * Never Played: Global Verification Test Runner
 * 
 * Runs all isolated and integration tests for the OSGi Governance Bridge.
 * Execution: deno task test
 */

const tests = [
  "persistence-shunting.test.ts",
  "test-lean-activator.ts",
  "test-universal-shunting.ts",
  "test-firebase-auth.ts",
  "test-mcp-client.ts",
  "verify-security.ts",
  "core-bundles.test.ts",
  "persistence-resilience.test.ts",
  "perceiver-carryover-sync.test.ts",
  "ontology-harmony.test.ts",
  "realm-as-being.test.ts",
  "being-realms.test.ts",
  "primordial-bootstrapping.test.ts",
  "platonic-lobby.test.ts",
  "grounding-soul.test.ts"
];

console.log("🏛️  Never Played: Strategic Regression Suite Starting...");
console.log("------------------------------------------------------");

let totalPassed = 0;

for (const test of tests) {
  console.log(`\n📦 RUNNING: ${test}`);
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", `tests/${test}`],
    stdout: "inherit",
    stderr: "inherit"
  });

  const { success, code } = await command.output();
  if (success) {
    totalPassed++;
    console.log(`✅ ${test} PASSED.`);
  } else {
    console.error(`❌ ${test} FAILED with exit code ${code}.`);
  }
}

console.log("\n------------------------------------------------------");
console.log(`🏁 REGRESSION FINISHED: ${totalPassed}/${tests.length} passed.`);

if (totalPassed === tests.length) {
  console.log("🏛️  ALL SYSTEMS NOMINAL. GOVERNANCE BRIDGE IS SECURE.");
  Deno.exit(0);
} else {
  console.error("🏛️  CRITICAL REGRESSION DETECTED. DO NOT MERGE.");
  Deno.exit(1);
}
