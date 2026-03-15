//import { serveDir } from "jsr:@std/http/file-server";
import { serveDir, serveFile } from "https://deno.land/std@0.207.0/http/file_server.ts";
const port = 8008;  // Port number
Deno.serve({ port }, async (req) => {
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
