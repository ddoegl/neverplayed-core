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

let msgId = 1;

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
  console.log("🚀 Initializing MCP Server...");
  await send({ method: "initialize", params: {}, id: msgId++ });

  console.log("\n📦 Fetching all configurations...");
  const pids = [
    "@neverplayed/config-admin",
    "@neverplayed/shell-cli",
    "@neverplayed/system-logger",
    "@neverplayed/auth-shield",
    "@neverplayed/limes"
  ];

  console.log(`Found ${pids.length} configuration PIDs to update.`);

  for (const pid of pids) {
    const configRes = await send({
      method: "tools/call",
      params: { name: "osgi_get_config", arguments: { pid } },
      id: msgId++
    });
    const config = JSON.parse(configRes.result.content[0].text);

    let updated = false;
    const propsToUpdate: Record<string, unknown> = {};

    if ("log-level" in config) {
      propsToUpdate["log-level"] = "INFO";
      updated = true;
    }
    if ("agent-log-level" in config) {
      propsToUpdate["agent-log-level"] = "INFO";
      updated = true;
    }

    if (updated) {
      console.log(`⚙️ Updating ${pid} to INFO...`);
      const updateRes = await send({
        method: "tools/call",
        params: {
          name: "osgi_update_config",
          arguments: { pid, properties: propsToUpdate }
        },
        id: msgId++
      });
      console.log(`   Result: ${updateRes.result.content[0].text}`);
    }
  }

  console.log("\n✅ All log levels successfully updated to INFO via MCP!");
  process.kill();
})().catch(err => {
  console.error("Script failed:", err);
  process.kill();
});
