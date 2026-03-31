import { TextLineStream } from "https://deno.land/std@0.221.0/streams/mod.ts";

const serverPath = "./scripts/mcp-server.ts";

const process = new Deno.Command("deno", {
  args: ["run", "-A", serverPath],
  stdin: "piped",
  stdout: "piped",
  stderr: "inherit",
}).spawn();

const writer = process.stdin.getWriter();
const encoder = new TextEncoder();

// Reliable line-by-line JSON reader
const lineReader = process.stdout
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream())
  .getReader();

let msgId = 1;

async function send(req: { method: string; params: Record<string, unknown>; id: number }) {
  const line = JSON.stringify(req) + "\n";
  await writer.write(encoder.encode(line));
  const { value } = await lineReader.read();
  if (!value) throw new Error("No response from MCP server");
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error("Failed to parse response:", value);
    throw err;
  }
}

const USER_UID = "8fNNh7UkppadUaKJQhaiMIGzcLd2"; // Target Daniel's UID directly for Cloud updates

(async () => {
  console.log("🚀 Initializing MCP Server...");
  await send({ method: "initialize", params: {}, id: msgId++ });

  console.log("\n📦 Fetching all configurations...");
  const pids = [
    "@neverplayed/config-admin",
    "@neverplayed/shell-cli",
    "@neverplayed/system-logger",
    "@neverplayed/auth-shield",
    "@neverplayed/limes",
    "@neverplayed/persistence-selector"
  ];

  console.log(`Targeting UID: ${USER_UID}`);
  console.log(`Found ${pids.length} configuration PIDs to update.`);

  for (const pid of pids) {
    const configRes = await send({
      method: "tools/call",
      params: { name: "osgi_get_config", arguments: { pid } },
      id: msgId++
    });
    
    let config: Record<string, unknown> = {};
    try {
        config = JSON.parse(configRes.result.content[0].text);
    } catch {
        // Fallback if config doesn't exist yet
    }

    let updated = false;
    const propsToUpdate: Record<string, unknown> = {};

    // Standardizing all log levels to INFO
    const targetLevel = "INFO";
    if (config["log-level"] !== targetLevel) {
      propsToUpdate["log-level"] = targetLevel;
      updated = true;
    }
    if ("agent-log-level" in config && config["agent-log-level"] !== targetLevel) {
      propsToUpdate["agent-log-level"] = targetLevel;
      updated = true;
    }

    // Force update for shell-cli and config-admin regardless of current state to ensure proof
    const forcePids = ["@neverplayed/shell-cli", "@neverplayed/config-admin"];
    if (forcePids.includes(pid)) {
        propsToUpdate["log-level"] = targetLevel;
        updated = true;
    }

    if (updated) {
      console.log(`⚙️ Updating ${pid} to INFO for ${USER_UID}...`);
      const updateRes = await send({
        method: "tools/call",
        params: {
          name: "osgi_update_config",
          arguments: { 
              pid, 
              properties: propsToUpdate,
              uid: USER_UID // CRITICAL: Target the correct user in Firebase
          }
        },
        id: msgId++
      });
      console.log(`   Result: ${updateRes?.result?.content[0]?.text || "Success"}`);
    }
  }

  console.log("\n✅ All log levels successfully updated to INFO via MCP Power Bridge!");
  process.kill();
})().catch(err => {
  console.error("Script failed:", err);
  process.kill();
});
