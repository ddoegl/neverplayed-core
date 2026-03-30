/**
 * One-off audit for AuthShield via MCP.
 */
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

    // 2. List Services
    console.log("📡 Auditing OSGi Registry...");
    await send(writer, { jsonrpc: "2.0", method: "tools/call", params: { name: "osgi_list_services", arguments: {} }, id: 2 });
    
    let responseText = "";
    while (true) {
        const { value } = await reader.read();
        responseText += decoder.decode(value);
        if (responseText.includes("}\n")) break;
    }

    try {
        const result = JSON.parse(responseText.split("\n").find(l => l.includes("result")) || "{}");
        const services = JSON.parse(result.result.content[0].text);
        console.log(`Registered Services (${services.length}):`);
        services.forEach((s: any) => console.log(` - ${s.id}`));

        const authShield = services.find((s: any) => s.id === "@neverplayed/auth-shield/service");
        
        if (authShield) {
            console.log("✅ AuthShield is running!");
            console.log("Properties:", JSON.stringify(authShield.properties, null, 2));
        } else {
            console.log("❌ AuthShield is NOT found in the registry.");
        }
    } catch (err) {
        console.error("Failed to parse audit result:", err);
    }

    process.kill();
    Deno.exit(0);
})();
