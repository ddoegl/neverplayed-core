//import { serveDir } from "jsr:@std/http/file-server";
import { serveDir, serveFile } from "https://deno.land/std@0.207.0/http/file_server.ts";

Deno.serve(async (req) => {
  const res = await serveDir(req, {
    fsRoot: "client",
  });
  const enableCache = Deno.env.get("ENABLE_CACHE") === "true";
  if (!enableCache) {
    res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  }
  return res;
});
