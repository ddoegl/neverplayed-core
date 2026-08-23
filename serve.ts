import { serveDir } from "https://deno.land/std@0.207.0/http/file_server.ts";

// Configurable port: --port 8008, --port=8008, bare 8008, or PORT env var (defaults to 8008)
let port = 8008;
const portEquals = Deno.args.find(a => a.startsWith("--port="))?.split("=")[1];
const portIndex = Deno.args.indexOf("--port");
if (portEquals) {
  port = parseInt(portEquals, 10);
} else if (portIndex !== -1 && Deno.args[portIndex + 1]) {
  port = parseInt(Deno.args[portIndex + 1], 10);
} else if (Deno.args[0] && !isNaN(parseInt(Deno.args[0], 10))) {
  port = parseInt(Deno.args[0], 10);
} else if (Deno.env.get("PORT")) {
  port = parseInt(Deno.env.get("PORT")!, 10);
}

console.log(`\n🚀 [Never Played Server] Booting static/bundle server on http://localhost:${port}\n`);

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);

  // Global preflight OPTIONS for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  // Handle POST for Digital Twin two-way sync
  if (req.method === "POST" && url.pathname === "/.neverplayed/state.json") {
    try {
      const data = await req.json();
      console.log(`\n[${new Date().toLocaleTimeString()}] 📥 Received digital twin POST update for state.json`);
      Deno.writeTextFileSync("./public/.neverplayed/state.json", JSON.stringify(data, null, 2));
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("Failed to parse or write POST body to state.json", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  const res = await serveDir(req, {
    fsRoot: "public",
  });
  const enableCache = Deno.env.get("ENABLE_CACHE") === "true";
  if (!enableCache) {
    res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  }
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
});

