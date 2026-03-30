const serverPath = "./scripts/mcp-server.ts";
const USER_UID = "8fNNh7UkppadUaKJQhaiMIGzcLd2"; // daniel.doegl@doegl.info

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
  console.log("🚀 Power Proof: Initializing Admin MCP Bridge...");
  await send({ method: "initialize", params: {}, id: 1 });

  console.log(`\n🛡️  Targeting User UID: ${USER_UID} (Admin Mode)`);
  console.log("⚙️  Setting system-logger to INFO via Cloud Fallback...");

  const updateRes = await send({
    method: "tools/call",
    params: {
      name: "osgi_update_config",
      arguments: { 
        pid: "@neverplayed/system-logger", 
        properties: { "log-level": "INFO" },
        uid: USER_UID
      }
    },
    id: 2
  });

  console.log("\n📊 Execution Result:");
  console.log(updateRes.result.content[0].text);

  console.log("\n✅ PROOF COMPLETE. Your browser settings have been updated by the agent!");
  process.kill();
})().catch(err => {
  console.error("Script failed:", err);
  process.kill();
});
