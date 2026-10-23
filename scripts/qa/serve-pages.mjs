#!/usr/bin/env node
/**
 * Servidor estático mínimo para testar ./out como o GitHub Pages serve:
 * /site-ecommerce/* → out/*, index.html de pastas, 301 de /pasta para /pasta/
 * e out/404.html (status 404) para o resto. Node puro, sem dependências.
 *
 * Uso: node scripts/qa/serve-pages.mjs [porta]   (padrão 4173)
 *      PAGES_BASE_PATH=/outro node scripts/qa/serve-pages.mjs
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "out");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const BASE = `/${(process.env.PAGES_BASE_PATH ?? "/site-ecommerce").replace(/^\/+|\/+$/g, "")}`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

if (!existsSync(OUT)) {
  console.error("out/ não existe: rode `npm run build:pages` antes.");
  process.exit(1);
}

function send404(res, url) {
  console.log(`404 ${url}`);
  const page = path.join(OUT, "404.html");
  res.writeHead(404, { "Content-Type": TYPES[".html"] });
  res.end(existsSync(page) ? readFileSync(page) : "404");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send404(res, req.url);
  }
  if (pathname === "/" || pathname === BASE) {
    res.writeHead(301, { Location: `${BASE}/${url.search}` });
    return res.end();
  }
  if (!pathname.startsWith(`${BASE}/`)) return send404(res, req.url);

  let file = path.join(OUT, pathname.slice(BASE.length));
  if (!file.startsWith(OUT)) return send404(res, req.url); // ../
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith("/")) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    file = path.join(file, "index.html");
  }
  if (!existsSync(file) || !statSync(file).isFile()) return send404(res, req.url);

  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => console.log(`demo estática em http://localhost:${PORT}${BASE}/ (servindo ${path.relative(ROOT, OUT)}/)`));
