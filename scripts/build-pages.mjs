#!/usr/bin/env node
/**
 * `npm run build:pages` — gera a DEMONSTRAÇÃO ESTÁTICA da loja em ./out, pronta
 * para o GitHub Pages em https://walter-maia.github.io/site-ecommerce/.
 *
 * O app completo depende de servidor (SQLite, Server Actions, cookies, proxy com
 * CSP por nonce, admin). O `output: "export"` do Next não aceita nada disso, então
 * o build roda numa CÓPIA temporária (.pages-build/, ignorada pelo git) em que:
 *
 *  1. saem as rotas que exigem servidor: proxy, /api, /lab, /admin/**, /pedido/[id]
 *     e as páginas de conta; entram as substitutas de src/static/routes/**
 *     (páginas informativas, /pedido/?id=…, /busca no cliente);
 *  2. páginas que só precisam de um ajuste (sem searchParams no servidor,
 *     generateStaticParams, force-static) são EMBRULHADAS: a original vira
 *     `_page.tsx` ao lado e o wrapper de src/static/routes a importa;
 *  3. src/server/** é trocado por stubs `export * from "@/static/server/…"` só
 *     para os módulos de CONTRATO (catálogo/manequins do src/data; sacola,
 *     curtidas, looks e pedidos no localStorage). Nenhum código de banco, auth
 *     ou admin entra na cópia: se algo ainda depender dele, o build quebra;
 *  4. `next build` roda com STATIC_EXPORT=1 (ramo estático do next.config.ts) e
 *     o resultado vai para ./out, com .nojekyll e uma CSP em <meta> com o hash
 *     de cada script inline da página (o Pages não envia cabeçalhos).
 *
 * As rotas e módulos originais do projeto não são tocados. Sem dependências novas.
 * Uso: node scripts/build-pages.mjs [--keep]   (--keep mantém .pages-build/ para depurar)
 * Variáveis opcionais: PAGES_BASE_PATH (padrão /site-ecommerce), PAGES_SITE_URL.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, ".pages-build");
const OUT = path.join(ROOT, "out");
const KEEP = process.argv.includes("--keep");

const BASE_PATH = `/${(process.env.PAGES_BASE_PATH ?? "/site-ecommerce").replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");
const SITE_URL = (process.env.PAGES_SITE_URL ?? `https://walter-maia.github.io${BASE_PATH}`).replace(/\/+$/, "");

/** Rotas/arquivos que exigem servidor: fora da cópia. */
const REMOVE = [
  "src/proxy.ts",
  "src/app/api",
  "src/app/admin",
  "src/app/(lab)",
  "src/app/(loja)/pedido/[id]",
  "src/app/(conta)/entrar",
  "src/app/(conta)/cadastro",
  "src/app/(conta)/conta",
  "src/components/admin", // só serve ao /admin (depende de src/server/admin)
  "src/server", // recriado abaixo só com os stubs de contrato
];

/** Módulos de CONTRATO (docs/ARQUITETURA.md) importados por páginas e componentes. */
const CONTRACT_MODULES = [
  "catalog",
  "mannequins",
  "session",
  "cart",
  "wishlist",
  "looks",
  "orders",
  "actions/cart",
  "actions/wishlist",
  "actions/looks",
  "actions/auth",
  "actions/checkout",
  "actions/newsletter",
];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const log = (msg) => console.log(`\x1b[36m[build:pages]\x1b[0m ${msg}`);
function fail(msg) {
  console.error(`\x1b[31m[build:pages] ${msg}\x1b[0m`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** Pastas (pré-ordem; uma pasta "__next.*" não é percorrida por dentro). */
function walkDirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.name.startsWith("__next.") ? [p] : [p, ...walkDirs(p)];
    });
}

/* ───────────── 1. cópia de build ───────────── */

log(`basePath ${BASE_PATH || "(raiz)"} · site ${SITE_URL}`);
rmSync(BUILD, { recursive: true, force: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
for (const item of ["package.json", "tsconfig.json", "next.config.ts", ".gitignore", "src", "public"]) {
  cpSync(path.join(ROOT, item), path.join(BUILD, item), { recursive: true });
}

/**
 * node_modules ESPELHADO com hardlinks (sem espaço extra em disco; cópia simples se o
 * hardlink falhar, ex.: outro volume). Não dá para usar junction/symlink: o Turbopack
 * recusa links que saem da raiz e, com a raiz no projeto original, ele acharia o
 * src/proxy.ts de lá (procura proxy subindo diretórios). Mesmo código no Windows e no CI.
 */
function mirror(src, dest, stats) {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (e.name === ".bin" || e.name === ".cache") continue;
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);
    if (e.isSymbolicLink()) {
      cpSync(realpathSync(from), to, { recursive: true, dereference: true });
      stats.copied++;
    } else if (e.isDirectory()) {
      mirror(from, to, stats);
    } else {
      try {
        linkSync(from, to);
        stats.linked++;
      } catch {
        copyFileSync(from, to);
        stats.copied++;
      }
    }
  }
  return stats;
}
const nm = mirror(path.join(ROOT, "node_modules"), path.join(BUILD, "node_modules"), { linked: 0, copied: 0 });
log(`cópia criada em .pages-build/ (node_modules: ${nm.linked} hardlinks, ${nm.copied} cópias)`);

/* ───────────── 2. rotas: remove, embrulha e substitui ───────────── */

for (const p of REMOVE) rmSync(path.join(BUILD, p), { recursive: true, force: true });

const ROUTES = path.join(BUILD, "src/static/routes");
for (const file of walk(ROUTES)) {
  const routeRel = path.relative(ROUTES, file).split(path.sep).join("/");
  const target = path.join(BUILD, "src/app", routeRel);
  let code = readFileSync(file, "utf8");
  const original = `"@/app/${routeRel.replace(/\.(tsx?|mjs|js)$/, "")}"`;
  if (code.includes(original)) {
    // Wrapper: a página original continua sendo usada, só muda de nome (não é mais rota).
    if (!existsSync(target)) fail(`wrapper ${routeRel} aponta para uma rota que não existe no projeto`);
    const privateName = `_${path.basename(target)}`;
    renameSync(target, path.join(path.dirname(target), privateName));
    code = code.split(original).join(`"./${privateName.replace(/\.(tsx?|mjs|js)$/, "")}"`);
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, code);
}
rmSync(ROUTES, { recursive: true, force: true });
log("rotas de servidor removidas; substitutas e wrappers instalados");

/* ───────────── 3. módulos de servidor → versões estáticas ───────────── */

for (const m of CONTRACT_MODULES) {
  if (!existsSync(path.join(BUILD, "src/static/server", `${m}.ts`))) fail(`falta src/static/server/${m}.ts`);
  const stub = path.join(BUILD, "src/server", `${m}.ts`);
  mkdirSync(path.dirname(stub), { recursive: true });
  writeFileSync(stub, `// Gerado por scripts/build-pages.mjs (demo estática). Não editar.\nexport * from "@/static/server/${m}";\n`);
}
log(`src/server → ${CONTRACT_MODULES.length} stubs de contrato (src/static/server)`);

/* ───────────── 4. next build (output: "export") ───────────── */

const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  NEXT_PUBLIC_STATIC_DEMO: "1",
  NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  NEXT_TELEMETRY_DISABLED: "1",
};
const nextBin = path.join(BUILD, "node_modules/next/dist/bin/next");
log("next build (export estático)…");
const res = spawnSync(process.execPath, [nextBin, "build"], { cwd: BUILD, env, stdio: "inherit" });
if (res.status !== 0) fail(`next build falhou (código ${res.status}). A cópia ficou em .pages-build/ para depuração.`);

cpSync(path.join(BUILD, "out"), OUT, { recursive: true });

/* ───────────── 5. pós-processamento de ./out ───────────── */

// Sem isso o Jekyll do GitHub Pages ignora pastas com "_" (o _next inteiro).
writeFileSync(path.join(OUT, ".nojekyll"), "");

/**
 * Arquivos de prefetch por segmento: o roteador pede `<rota>/__next.<seg>.<seg>.__PAGE__.txt`
 * (nome "achatado"). No Windows o export do Next 16.4 grava em PASTAS
 * (`__next.<seg>/<seg>/__PAGE__.txt`): convertSegmentPathToStaticExportFilename só troca "/"
 * e o caminho vem com "\". Aqui achatamos (no Linux do CI não há nada a fazer).
 */
let flattened = 0;
for (const dir of walkDirs(OUT)) {
  if (!path.basename(dir).startsWith("__next.")) continue;
  for (const file of walk(dir)) {
    const inner = path.relative(dir, file).split(path.sep).join(".");
    renameSync(file, `${dir}.${inner}`);
    flattened++;
  }
  rmSync(dir, { recursive: true, force: true });
}
if (flattened) log(`${flattened} arquivos de prefetch de segmento achatados (bug do export no Windows)`);

/**
 * CSP em <meta> (o Pages não permite cabeçalhos). Sem nonce possível num HTML
 * estático, cada página recebe o sha256 dos SEUS scripts inline (payload RSC do
 * Next e afins) em vez de 'unsafe-inline'. frame-ancestors não vale em <meta>.
 */
function cspFor(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.map((h) => `'sha256-${h}'`).join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const ATTR_URL_RE = /\s(?:href|src|action|poster)="([^"]*)"/gi;
const SRCSET_RE = /\s(?:srcset|srcSet|imagesrcset|imageSrcSet)="([^"]*)"/gi;
const problems = [];
const htmlFiles = walk(OUT).filter((f) => f.endsWith(".html"));

for (const file of htmlFiles) {
  let html = readFileSync(file, "utf8");
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(SCRIPT_RE)) {
    if (/\bsrc\s*=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs) || body.length === 0) continue;
    hashes.add(createHash("sha256").update(body, "utf8").digest("base64"));
  }
  if (/\son[a-z]+="/i.test(html.replace(SCRIPT_RE, ""))) problems.push(`${rel(file)}: atributo de evento inline (bloqueado pela CSP)`);

  const meta = `<meta http-equiv="Content-Security-Policy" content="${cspFor([...hashes])}"/>`;
  // Logo após o <meta charset> (que precisa ficar nos primeiros 1024 bytes) e antes de qualquer script.
  const charset = /<meta charSet="utf-8"\/?>/i.exec(html);
  html = charset ? html.replace(charset[0], `${charset[0]}${meta}`) : html.replace(/<head>/i, `<head>${meta}`);
  writeFileSync(file, html);

  // Toda URL interna precisa do basePath (senão vira 404 em walter-maia.github.io/…).
  const urls = [...html.matchAll(ATTR_URL_RE)].map((m) => m[1]);
  for (const [, set] of html.matchAll(SRCSET_RE)) urls.push(...set.split(",").map((s) => s.trim().split(/\s+/)[0]));
  for (const u of urls) {
    if (u.startsWith("/") && !u.startsWith("//") && BASE_PATH && u !== BASE_PATH && !u.startsWith(`${BASE_PATH}/`)) {
      problems.push(`${rel(file)}: URL sem basePath: ${u}`);
    }
  }
}

/* ───────────── 6. conferência ───────────── */

const must = ["index.html", "404.html", ".nojekyll", "sitemap.xml", "robots.txt", "manifest.webmanifest", "llms.txt", "llms-full.txt", "produto", "pedido/index.html", "entrar/index.html"];
for (const f of must) if (!existsSync(path.join(OUT, f))) problems.push(`faltando: out/${f}`);

const sitemap = existsSync(path.join(OUT, "sitemap.xml")) ? readFileSync(path.join(OUT, "sitemap.xml"), "utf8") : "";
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  if (!loc.startsWith(`${SITE_URL}/`)) {
    problems.push(`sitemap: URL fora de ${SITE_URL}: ${loc}`);
    continue;
  }
  const local = decodeURIComponent(loc.slice(SITE_URL.length)).replace(/\/$/, "/index.html");
  if (!existsSync(path.join(OUT, local))) problems.push(`sitemap aponta para arquivo inexistente: ${local}`);
}
const products = existsSync(path.join(OUT, "produto"))
  ? readdirSync(path.join(OUT, "produto")).filter((d) => existsSync(path.join(OUT, "produto", d, "index.html")))
  : [];

const size = walk(OUT).reduce((s, f) => s + statSync(f).size, 0);
log(`${htmlFiles.length} páginas HTML · ${products.length} produtos · ${locs.length} URLs no sitemap · ${(size / 1024 / 1024).toFixed(1)} MB`);

if (!KEEP) rmSync(BUILD, { recursive: true, force: true });

if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join("\n"));
  fail(`${problems.length} problema(s) no export.`);
}
log(`ok → ${rel(OUT)}/ (sirva com: node scripts/qa/serve-pages.mjs)`);
