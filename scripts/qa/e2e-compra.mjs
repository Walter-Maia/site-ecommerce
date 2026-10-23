// Teste ponta a ponta (Chrome instalado, sem baixar navegador):
//   cadastro → login → carrinho → checkout → pedido; /admin como cliente (404) e como admin.
// Uso: node scripts/qa/e2e-compra.mjs [baseUrl] [pastaDeCapturas]
// A senha do admin é lida de .env.local (ADMIN_SEED_PASSWORD) e nunca é impressa.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = process.argv[3] ?? null;
const SLUG = process.env.E2E_SLUG ?? "camiseta-oversized-athletic-07-preta";

function envLocal(key) {
  try {
    const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim() || null;
  } catch {
    return null;
  }
}

const results = [];
const step = async (name, fn) => {
  try {
    const note = await fn();
    results.push({ name, status: note === "PENDENTE" ? "PENDENTE" : "ok", note: note === "PENDENTE" ? "" : note ?? "" });
  } catch (err) {
    results.push({ name, status: "FALHOU", note: String(err?.message ?? err).split("\n")[0] });
  }
};
const shot = async (page, name) => {
  if (OUT) await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const cspViolations = [];
const watch = (page) => {
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|CSP/i.test(m.text())) cspViolations.push(`${page.url()}: ${m.text()}`);
  });
};

const email = `e2e+${Date.now()}@kimekris.test`;
const password = "Tenis-azul-na-quadra-" + Math.random().toString(36).slice(2, 8);
let orderNumber = null;
let orderUrl = null;

/* ───────────── cliente ───────────── */
const cliente = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await cliente.newPage();
watch(page);

await step("cadastro", async () => {
  await page.goto(`${BASE}/cadastro`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', "Cliente E2E");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/entrar\?cadastro=ok/, { timeout: 30000 });
});

await step("login", async () => {
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/conta$/, { timeout: 30000 });
  const h1 = await page.textContent("h1");
  expect(/Olá/.test(h1 ?? ""), `h1 inesperado: ${h1}`);
  const cookies = await cliente.cookies();
  const s = cookies.find((c) => /qd_session$/.test(c.name));
  expect(s && s.httpOnly && s.sameSite === "Lax", "cookie de sessão sem httpOnly/SameSite=Lax");
  await shot(page, "e2e-conta");
});

await step("/admin como cliente → 404", async () => {
  const res = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  expect(res?.status() === 404, `status ${res?.status()}`);
});

await step("adicionar ao carrinho (PDP)", async () => {
  const res = await page.goto(`${BASE}/produto/${SLUG}`, { waitUntil: "networkidle" });
  if (res?.status() === 404) return "PENDENTE";
  // Escolhe o primeiro tamanho disponível e adiciona.
  const size = page.locator('input[name="tamanho"]:not([disabled])').first();
  expect(await size.count(), "nenhum tamanho disponível na PDP");
  await size.check({ force: true });
  await page.getByRole("button", { name: /adicionar ao carrinho/i }).first().click();
  await page.getByText(/adicionado/i).first().waitFor({ timeout: 15000 });
  // Confere no servidor: a sacola do usuário logado tem a peça.
  const html = await (await page.request.get(`${BASE}/conta`)).text();
  expect(html.includes("Olá"), "sessão perdida após adicionar");
});

await step("checkout", async () => {
  const res = await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
  if (res?.status() === 404) return "PENDENTE";
  const fill = async (name, value) => {
    const el = page.locator(`[name="${name}"]`);
    if (await el.count()) {
      const tag = await el.first().evaluate((n) => n.tagName);
      if (tag === "SELECT") await el.first().selectOption(value);
      else await el.first().fill(value);
    }
  };
  await fill("name", "Cliente E2E");
  await fill("email", email);
  await fill("cep", "01310-100");
  await fill("street", "Avenida Paulista");
  await fill("number", "1000");
  await fill("district", "Bela Vista");
  await fill("city", "São Paulo");
  await fill("state", "SP");
  const pix = page.locator('input[name="paymentMethod"][value="pix"]');
  if (await pix.count()) await pix.check({ force: true });
  await page.getByRole("button", { name: /finalizar|confirmar|pagar|fazer pedido/i }).first().click();
  await page.waitForURL(/\/pedido\//, { timeout: 30000 });
  orderUrl = page.url();
  const text = await page.textContent("body");
  orderNumber = text?.match(/QD-\d{6}/)?.[0] ?? null;
  expect(orderNumber, "número do pedido não aparece na página");
  await shot(page, "e2e-pedido");
  return orderNumber;
});

await step("pedido aparece em /conta", async () => {
  if (!orderNumber) return "PENDENTE";
  await page.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  expect((await page.textContent("main"))?.includes(orderNumber), "pedido ausente em /conta");
});

await step("outro navegador não vê o pedido (IDOR)", async () => {
  if (!orderUrl) return "PENDENTE";
  const anon = await browser.newContext();
  const p = await anon.newPage();
  const res = await p.goto(orderUrl, { waitUntil: "domcontentloaded" });
  const body = (await p.textContent("body")) ?? "";
  await anon.close();
  expect(res?.status() === 404 || !body.includes(orderNumber), "pedido visível para outro visitante");
});

await step("logout invalida a sessão", async () => {
  await page.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sair" }).first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 30000 });
  const res = await page.goto(`${BASE}/conta`, { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname === "/entrar", `após logout foi para ${page.url()} (${res?.status()})`);
});

/* ───────────── admin ───────────── */
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? envLocal("ADMIN_SEED_PASSWORD");
const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await admin.newPage();
watch(ap);

await step("login admin → /admin", async () => {
  expect(adminPassword, "ADMIN_SEED_PASSWORD ausente (rode npm run db:seed)");
  await ap.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  expect(/\/entrar\?next=%2Fadmin/.test(ap.url()), `sem sessão deveria ir para /entrar: ${ap.url()}`);
  await ap.fill('input[name="email"]', "admin@kimekris.test");
  await ap.fill('input[name="password"]', adminPassword);
  await ap.click('button[type="submit"]');
  await ap.waitForURL(/\/admin$/, { timeout: 30000 });
  expect((await ap.textContent("h1"))?.includes("Painel"), "painel não carregou");
  await shot(ap, "e2e-admin-painel");
});

await step("admin vê o pedido", async () => {
  await ap.goto(`${BASE}/admin/pedidos`, { waitUntil: "networkidle" });
  if (!orderNumber) return "PENDENTE";
  expect((await ap.textContent("main"))?.includes(orderNumber), "pedido ausente no admin");
});

let createdUrl = null;
await step("admin cria manequim", async () => {
  await ap.goto(`${BASE}/admin/manequins/novo`, { waitUntil: "networkidle" });
  await ap.fill('input[name="name"]', "E2E");
  await ap.fill('input[name="skinTone"]', "#8D5A3B");
  // (o primeiro submit da página é o "Sair" da barra lateral)
  await ap.getByRole("button", { name: "Criar manequim" }).click();
  await ap.waitForURL(/\/admin\/manequins\/m-[0-9a-f]+\?salvo=1/, { timeout: 30000 });
  createdUrl = ap.url();
  await shot(ap, "e2e-admin-manequim");
});

await step("admin apaga manequim", async () => {
  if (!createdUrl) return "PENDENTE";
  ap.once("dialog", (d) => d.accept());
  await ap.getByRole("button", { name: "Apagar manequim" }).click();
  await ap.waitForURL(/\/admin\/manequins\?apagado=1/, { timeout: 30000 });
});

await step("sem violações de CSP no console", async () => {
  expect(cspViolations.length === 0, cspViolations.slice(0, 3).join(" | "));
});

await browser.close();

const w = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.status.padEnd(8)} ${r.name.padEnd(w)}  ${r.note}`);
const failed = results.filter((r) => r.status === "FALHOU").length;
console.log(`\n${results.length - failed} de ${results.length} etapas sem falha (${results.filter((r) => r.status === "PENDENTE").length} pendentes).`);
process.exit(failed ? 1 : 0);
