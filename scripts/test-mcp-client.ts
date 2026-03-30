/**
 * Mock MCP Client for testing our OSGi bridge.
 * Run via: deno run -A scripts/test-mcp-client.ts
 */

const serverPath = "./scripts/mcp-server.ts";

const process = new Deno.Command("deno", {
  args: ["run", "-A", serverPath],
  stdin: "piped",
  stdout: "piped",
  stderr: "inherit",
}).spawn();

const writer = process.stdin.getWriter();
const reader = process.stdout.getReader();
const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function send(req: { method: string; params: Record<string, unknown>; id: number }) {
  const line = JSON.stringify(req) + "\n";
  await writer.write(encoder.encode(line));
  const { value } = await reader.read();
  const res = decoder.decode(value).trim();
  try {
    return JSON.parse(res);
  } catch (err) {
    console.error("Failed to parse response:", res);
    throw err;
  }
}

(async () => {
  console.log("🚀 Testing MCP Server Initialization...");
  const init = await send({ method: "initialize", params: {}, id: 1 });
  console.log("Init Result:", init);

  console.log("\n📦 Listing Tools...");
  const tools = await send({ method: "tools/list", params: {}, id: 2 });
  console.log("Tools Result:", tools);

  console.log("\n📡 Calling osgi_list_services...");
  const services = await send({ 
    method: "tools/call", 
    params: { name: "osgi_list_services", arguments: {} }, 
    id: 3 
  });
  console.log("Lines in service list:", services.result.content[0].text.split("\n").length);

  // 4. Test Calling a Service Method (e.g. Shell CLI history)
  console.log("\n📞 Calling shell_cli.getHistory...");
  const history = await send({
    method: "tools/call",
    params: { 
      name: "osgi_call_method", 
      arguments: { 
        serviceId: "@neverplayed/shell-cli/service", 
        method: "getHistory", 
        args: [] 
      } 
    },
    id: 4
  });
  console.log("History entries:", JSON.parse(history.result.content[0].text).length);

  // 5. Test Config Management
  console.log("\n⚙️ Testing Config Management (osgi_get_config)...");
  const config = await send({
    method: "tools/call",
    params: {
      name: "osgi_get_config",
      arguments: { pid: "@neverplayed/config-admin" }
    },
    id: 5
  });
  console.log("Current Config for ConfigAdmin:", config.result.content[0].text);

  console.log("\n📝 Testing Config Update (osgi_update_config)...");
  const update = await send({
    method: "tools/call",
    params: {
      name: "osgi_update_config",
      arguments: { 
        pid: "@neverplayed/system-logger", 
        properties: { "log-level": "WARN" } 
      }
    },
    id: 6
  });
  console.log("Update Result:", update.result.content[0].text);

  process.kill();
})().catch(err => {
  console.error("Test failed:", err);
  process.kill();
});
