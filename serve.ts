//import { serveDir } from "jsr:@std/http/file-server";
import { serveDir } from "https://deno.land/std@0.207.0/http/file_server.ts";
const port = 8008;  // Port number
Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);

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

  // Preflight OPTIONS for CORS (necessary since POST from a browser triggers preflight)
  if (req.method === "OPTIONS" && url.pathname === "/.neverplayed/state.json") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
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
  // Relaxing these headers fixes CORS/COEP blocks for external scripts from unpkg.
  // res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
});
