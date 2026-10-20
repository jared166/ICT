// Servidor estático mínimo para desarrollo y pruebas (no se usa en producción).
// Uso: node tools/serve.mjs [puerto] [subruta]
//   node tools/serve.mjs 8080          → http://localhost:8080/
//   node tools/serve.mjs 8080 /ICT/    → simula GitHub Pages bajo subruta
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon", ".woff2": "font/woff2"
};

export function startServer(port = 8080, base = "/") {
  if (!base.endsWith("/")) base += "/";
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      let p = decodeURIComponent(url.pathname);
      if (!p.startsWith(base)) {
        if (p + "/" === base) { res.writeHead(301, { Location: base }); return res.end(); }
        res.writeHead(404); return res.end("Not found");
      }
      p = "/" + p.slice(base.length);
      let file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT) || p.split("/").some((s) => s.startsWith(".") && s !== "")) { res.writeHead(403); return res.end(); }
      let st = await stat(file).catch(() => null);
      if (st && st.isDirectory()) {
        if (!url.pathname.endsWith("/")) { res.writeHead(301, { Location: url.pathname + "/" + url.search }); return res.end(); }
        file = join(file, "index.html");
        st = await stat(file).catch(() => null);
      }
      if (!st) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      let body = await readFile(file);
      const type = TYPES[extname(file)] || "application/octet-stream";
      const headers = { "Content-Type": type, "Cache-Control": "no-store" };
      // Compresión gzip para texto, como hace GitHub Pages (así las mediciones locales se parecen a producción).
      if (/text|javascript|json|svg/.test(type) && /gzip/.test(req.headers["accept-encoding"] || "")) {
        body = gzipSync(body);
        headers["Content-Encoding"] = "gzip";
      }
      res.writeHead(200, headers);
      res.end(body);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8080);
  const base = process.argv[3] || "/";
  startServer(port, base).then(() => console.log(`Sirviendo ${ROOT} en http://localhost:${port}${base}`));
}
