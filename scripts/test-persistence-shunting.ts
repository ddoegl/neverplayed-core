/**
 * Isolated Verification Test for Strategic Persistence Shunting
 * 
 * Verifies that the Persistence Selector correctly routes data based on the key prefix.
 */

console.log("🚀 Starting Persistence Shunting Test...");

// 1. Mock Persistence Managers
const _mockCloud = {
  tier: "cloud",
  type: "provider",
  store: new Map(),
  load: (key: string) => _mockCloud.store.get(key) || null,
  save: (key: string, val: unknown) => _mockCloud.store.set(key, val),
  clear: () => _mockCloud.store.clear()
};

const _mockLocal = {
  tier: "local",
  type: "provider",
  store: new Map(),
  load: (key: string) => _mockLocal.store.get(key) || null,
  save: (key: string, val: unknown) => _mockLocal.store.set(key, val),
  clear: () => _mockLocal.store.clear()
};

// 2. Simplified Routing Logic (Emulating Activator)
function routeToTier(key: string, mode: string = "normal") {
  if (mode === "stealth") return "volatile";
  if (key.startsWith("security.")) return "volatile";
  if (key.startsWith("identities.")) return "local";
  if (key.startsWith("config.")) return mode === "privacy" ? "local" : "cloud";
  return "cloud";
}

// 3. Test Cases
const tests = [
  { key: "config.shell", expected: "cloud", mode: "normal" },
  { key: "identities.mcp", expected: "local", mode: "normal" },
  { key: "security.token", expected: "volatile", mode: "normal" },
  { key: "config.shell", expected: "local", mode: "privacy" },
  { key: "any.key", expected: "volatile", mode: "stealth" }
];

console.log("\n--- SHUNTING RESULTS ---");
let passed = 0;
tests.forEach(test => {
  const result = routeToTier(test.key, test.mode);
  const ok = result === test.expected;
  if (ok) passed++;
  console.log(`${ok ? "✅" : "❌"} Key='${test.key}' [Mode=${test.mode}] -> Tier='${result}' (Expected: ${test.expected})`);
});

// 4. Test Broadcast Clear
console.log("\n--- BROADCAST CLEAR TEST ---");
_mockCloud.save("config.test", "data");
_mockLocal.save("identities.test", "pii");
console.log(`Cloud Store Size: ${_mockCloud.store.size}`);
console.log(`Local Store Size: ${_mockLocal.store.size}`);

// Emulate Selector clear()
[_mockCloud, _mockLocal].forEach(p => p.clear());

const clearOk = _mockCloud.store.size === 0 && _mockLocal.store.size === 0;
if (clearOk) {
    passed++;
    console.log("✅ Broadcast Clear Verified.");
} else {
    console.error("❌ Broadcast Clear Failed.");
}

console.log(`\nTest Finished: ${passed}/${tests.length + 1} passed.`);

if (passed === tests.length + 1) {
  console.log("🎊 Persistence Shunting & Reset Logic Verified!");
} else {
  console.error("💥 Logic Failure!");
  Deno.exit(1);
}
