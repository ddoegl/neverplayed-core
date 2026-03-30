/**
 * Helper to update OSGi config via MCP server.
 */
import { parseArgs } from "https://deno.land/std@0.221.0/cli/parse_args.ts";

const args = parseArgs(Deno.args);
const PID = args.pid;
const PROP = args.prop;
const VALUE = args.value;

if (!PID || !PROP || !VALUE) {
    console.error("Usage: deno task mcp-update --pid <PID> --prop <PROP> --value <VALUE>");
    Deno.exit(1);
}

const serverPath = new URL("./mcp-server.ts", import.meta.url).pathname;

async function send(writer: WritableStreamDefaultWriter<Uint8Array>, request: any) {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(JSON.stringify(request) + "\n"));
}

(async () => {
    const process = new Deno.Command("deno", {
      args: ["run", "-A", serverPath],
      stdin: "piped",
      stdout: "piped",
      stderr: "inherit"
    }).spawn();

    const decoder = new TextDecoder();
    const reader = process.stdout.getReader();
    const writer = process.stdin.getWriter();

    // 1. Initialize
    await send(writer, { jsonrpc: "2.0", method: "initialize", params: {}, id: 1 });
    await reader.read(); // Read Init Response

    // 2. Get Current Config
    console.log(`📡 Checking current configuration for ${PID}...`);
    await send(writer, { 
        jsonrpc: "2.0", 
        method: "tools/call", 
        params: { 
            name: "osgi_get_config", 
            arguments: { pid: PID } 
        }, 
        id: 2 
    });

    let getResp = "";
    while (true) {
        const { value } = await reader.read();
        getResp += decoder.decode(value);
        if (getResp.includes("}\n")) break;
    }
    console.log("Current Config:", getResp.trim());

    // 3. Update Config
    console.log(`📡 Sending Update for ${PID} (${PROP}=${VALUE})...`);
    await send(writer, { 
        jsonrpc: "2.0", 
        method: "tools/call", 
        params: { 
            name: "osgi_update_config", 
            arguments: { 
                pid: PID, 
                properties: { [PROP]: VALUE } 
            } 
        }, 
        id: 3 
    });
    
    let responseText = "";
    while (true) {
        const { value } = await reader.read();
        responseText += decoder.decode(value);
        if (responseText.includes("}\n")) break;
    }

    console.log("MCP Response:", responseText.trim());

    process.kill();
    Deno.exit(0);
})();
