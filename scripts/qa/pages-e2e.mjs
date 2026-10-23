// Teste ponta a ponta da DEMO ESTÁTICA (GitHub Pages) servida por scripts/qa/serve-pages.mjs.
// Usa o Chrome instalado (playwright-core, sem baixar navegador).
// Uso: node scripts/qa/pages-e2e.mjs [baseUrl] [pastaDeCapturas]
//   baseUrl padrão: http://localhost:4173/site-ecommerce
// Registra erros de console, exceções de página, violações de CSP e QUALQUER resposta >= 400
// (o único 404 esperado é a página inexistente testada de propósito).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:4173/site-ecommerce").replace(/\/$/, "");
const OUT = process.argv[3] ?? null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const results = [];
const problems = { console: [], pageErrors: [], badResponses: [], failedRequests: [] };
const EXPECTED_404 = /\/nao-existe\//;

const step = async (name, fn) => {
  try {
    const note = await fn();
    results.push({ name, status: "ok", note: note ?? "" });
  } catch (err) {
    results.push({ name, status: "FALHOU", note: String(err?.message ?? err).split("\n")[0] });
  }
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const shot = async (page, name, full = true) => {
  if (!OUT) return;
  if (full) {
    await loadAllImages(page);
    // seções com content-visibility e reveals entram já pintadas na captura de página inteira
    await page.addStyleTag({ content: ".cv-auto { content-visibility: visible !important; }" }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-in", ""))).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
};

/** Rola a página inteira (imagens lazy carregam), volta ao topo e devolve quantas <img> quebraram. */
async function loadAllImages(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.evaluate(() => [...document.images].filter((i) => i.complete && i.currentSrc && i.naturalWidth === 0).map((i) => i.currentSrc));
}

/** Home é alta demais para uma captura de página inteira (o Chrome repete blocos): uma captura por seção. */
async function shotSections(page, prefix, anchors) {
  if (!OUT) return;
  await loadAllImages(page);
  await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-in", "")));
  for (const [i, sel] of anchors.entries()) {
    await page.evaluate((s) => (s ? document.querySelector(s)?.scrollIntoView({ block: "start" }) : window.scrollTo(0, 0)), sel);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${prefix}-${String.fromCharCode(97 + i)}.png`) });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
const HOME_ANCHORS = [null, "#mais-vendidos", "#social-club-titulo", "#novidades-titulo", "#pv-teaser-h", "#role-titulo", "#role-produtos", "footer"];

const watch = (page) => {
  page.on("console", (m) => {
    // o 404 do próprio documento na página inexistente testada de propósito não conta
    if (m.type() === "error" && !(EXPECTED_404.test(page.url()) && /status of 404/.test(m.text()))) problems.console.push(`${page.url()} → ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.pageErrors.push(`${page.url()} → ${String(e)}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !EXPECTED_404.test(r.url())) problems.badResponses.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "";
    // navegações canceladas/abortadas pelo próprio teste não contam
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(f)) problems.failedRequests.push(`${f} ${r.url()}`);
  });
};

const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await desk.newPage();
watch(page);
const go = (p) => page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 60000 });
const bagCount = async (pg = page) => Number(((await pg.getByRole("button", { name: /^Sacola, \d+/ }).first().getAttribute("aria-label")) ?? "").match(/\d+/)?.[0] ?? -1);

/* ───────────── loja ───────────── */

await step("home (todas as seções)", async () => {
  const res = await go("/");
  expect(res?.status() === 200, `status ${res?.status()}`);
  const ids = ["mais-vendidos", "social-club-titulo", "novidades-titulo", "pv-teaser-h", "y2k-titulo", "role-titulo", "role-produtos"];
  for (const id of ids) expect(await page.locator(`#${id}`).count(), `seção #${id} ausente`);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').count() === 1, "sem CSP em <meta>");
  const broken = await loadAllImages(page);
  expect(broken.length === 0, `imagens quebradas: ${broken.join(", ")}`);
  const imgs = await page.evaluate(() => [...document.images].filter((i) => i.naturalWidth > 0).length);
  const notice = await page.locator("footer").innerText();
  expect(/Versão estática \(GitHub Pages\)/.test(notice), "aviso de demo estática ausente no rodapé");
  await shotSections(page, "01-home-1440", HOME_ANCHORS);
  return `${ids.length} seções, ${imgs} imagens carregadas e 0 quebradas, aviso no rodapé, CSP em <meta>`;
});

await step("menu", async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Feminino" }).first();
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(700);
  await shot(page, "02-menu-1440", false);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
});

await step("listagem com filtro na URL (?categoria=&ordem=)", async () => {
  await go("/feminino/?categoria=saias&ordem=menor-preco");
  const count = Number((await page.locator("#resultado-titulo .tabular").innerText()).trim());
  const cards = page.locator("main ul.grid > li article");
  const n = await cards.count();
  expect(n === count && n > 0, `contador ${count} ≠ cards ${n}`);
  const names = await cards.locator("h3").allInnerTexts();
  expect(names.every((t) => /saia/i.test(t)), `peça fora da categoria: ${names.join(" | ")}`);
  const prices = await cards.evaluateAll((els) => els.map((el) => Number((el.querySelector("p.tabular > span.font-medium")?.textContent ?? "").replace(/[^\d]/g, ""))));
  const sorted = [...prices].sort((a, b) => a - b);
  expect(JSON.stringify(prices) === JSON.stringify(sorted), `ordem não é menor preço: ${prices.join(",")}`);
  expect(await page.getByRole("list", { name: "Filtros ativos" }).getByText("Saias").count(), "chip do filtro ausente");
  const current = await page.locator('nav[aria-label="Principal"] a[aria-current="page"]').innerText().catch(() => "");
  expect(/feminino/i.test(current), `link ativo do header: "${current}"`);
  await shot(page, "03-feminino-saias-menor-preco-1440");
  return `${n} saias por menor preço`;
});

await step("filtro no cliente (clique) e coleção", async () => {
  await go("/novidades/");
  const before = Number(await page.locator("#resultado-titulo .tabular").innerText());
  await page.locator('aside[aria-label="Filtros"] label[for="d-col-role"]').click();
  await page.waitForURL(/colecao=role/, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Rolê"), null, { timeout: 15000 });
  const after = Number(await page.locator("#resultado-titulo .tabular").innerText());
  expect(after > 0 && after !== before, `contagem não mudou (${before} → ${after})`);
  await page.locator('aside[aria-label="Filtros"] label[for="d-preco-ate-150"]').click();
  await page.waitForURL(/preco=ate-150/, { timeout: 15000 });
  const url = page.url();
  return `novidades ${before} → Rolê ${after}; URL ${url.slice(url.indexOf("/novidades"))}`;
});

await step("busca (?q=) e busca pelo header", async () => {
  await go("/busca/?q=moletom");
  expect((await page.locator("h1").innerText()).includes("Resultados"), "h1 não virou Resultados");
  const n = await page.locator("#resultados-titulo + ul > li").count();
  expect(n > 0, "sem resultados para moletom");
  await page.waitForFunction(() => document.title.startsWith("Busca: moletom"), null, { timeout: 5000 }).catch(() => {});
  expect((await page.title()).startsWith("Busca: moletom"), `título: ${await page.title()}`);
  await shot(page, "04-busca-moletom-1440");
  await page.getByRole("button", { name: "Buscar", exact: true }).first().click();
  const input = page.locator("#busca-overlay");
  await input.waitFor({ state: "visible" });
  await input.fill("jersey");
  await input.press("Enter");
  await page.waitForURL(/\/busca\/\?q=jersey/, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("#resultados-titulo + ul > li").length > 0, null, { timeout: 15000 });
  const m = await page.locator("#resultados-titulo + ul > li").count();
  return `moletom: ${n}, jersey: ${m}`;
});

let orderNumber = "";
await step("PDP → adicionar → sacola (drawer) → /carrinho", async () => {
  await go("/produto/camiseta-oversized-athletic-07-preta/");
  expect((await page.locator("h1").innerText()).length > 3, "PDP sem h1");
  await page.locator('fieldset input[name="tamanho"]:not([disabled]) + label').first().click();
  await page.getByRole("button", { name: /Adicionar ao carrinho/ }).click();
  const drawer = page.getByRole("dialog").filter({ hasText: "Finalizar compra" }).first();
  await drawer.waitFor({ state: "visible", timeout: 15000 });
  expect((await bagCount()) === 1, `sacola com ${await bagCount()} itens`);
  await page.waitForTimeout(600);
  await shot(page, "05-pdp-sacola-1440", false);
  await drawer.getByRole("link", { name: "Ver sacola completa" }).click();
  await page.waitForURL(/\/carrinho\/$/, { timeout: 15000 });
  await page.getByText("Camiseta Oversized").first().waitFor({ timeout: 15000 });
  await shot(page, "06-carrinho-1440");
});

await step("sacola persiste após recarregar (localStorage)", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => /Sacola, 1 item/.test(document.querySelector('button[aria-label^="Sacola"]')?.getAttribute("aria-label") ?? ""), null, { timeout: 10000 });
  expect((await page.locator("main").innerText()).includes("Camiseta Oversized"), "linha sumiu");
});

await step("/checkout: validação no cliente + pagamento simulado → /pedido/?id=", async () => {
  await page.getByRole("link", { name: "Finalizar compra" }).first().click();
  await page.waitForURL(/\/checkout\/$/, { timeout: 15000 });
  await page.locator("#checkout-form").waitFor();
  await page.locator('#checkout-form button[type="submit"]:visible').click();
  await page.getByRole("alert").filter({ hasText: "Revise os campos destacados." }).waitFor({ timeout: 10000 });
  expect(await page.getByText("Informe seu nome completo.").count(), "erro de campo ausente");
  await page.fill("#co-name", "Ana Demo Estática");
  await page.fill("#co-email", "ana@example.com");
  await page.fill("#co-cep", "01310100");
  await page.fill("#co-street", "Avenida Paulista");
  await page.fill("#co-number", "1000");
  await page.fill("#co-district", "Bela Vista");
  await page.fill("#co-city", "São Paulo");
  await page.selectOption("#co-state", "SP");
  await shot(page, "07-checkout-1440");
  await page.locator('#checkout-form button[type="submit"]:visible').click();
  await page.waitForURL(/\/pedido\/\?id=[0-9a-f-]{36}$/, { timeout: 20000 });
  await page.locator("h1").filter({ hasText: "Pedido recebido" }).waitFor({ timeout: 15000 });
  orderNumber = (await page.locator("main p .tabular").first().innerText()).trim();
  expect(/^QD-\d{6}$/.test(orderNumber), `número do pedido: ${orderNumber}`);
  expect(await page.getByRole("img", { name: /QR Code ilustrativo/ }).count(), "QR do Pix ausente");
  expect((await bagCount()) === 0, "sacola não esvaziou após o pedido");
  await shot(page, "08-pedido-1440");
  return `pedido ${orderNumber}`;
});

await step("/conta (aviso + pedidos deste navegador)", async () => {
  await go("/conta/");
  expect((await page.locator("h1").innerText()).includes("versão com servidor"), "h1 do aviso");
  await page.getByText(orderNumber).waitFor({ timeout: 10000 });
  await shot(page, "09-conta-1440");
});

let likedName = "";
await step("curtir na loja → aparece em Curtidas no provador", async () => {
  await go("/feminino/");
  const card = page.locator("main ul.grid > li:has(article)").first();
  const heart = card.getByRole("button", { name: /^Curtir / });
  likedName = ((await heart.getAttribute("aria-label")) ?? "").replace(/^Curtir /, "");
  await heart.click();
  await card.getByRole("button", { name: `Remover ${likedName} das curtidas` }).waitFor({ timeout: 10000 });
  await page.getByRole("link", { name: "Provador 3D" }).first().click();
  await page.waitForURL(/\/provador\/$/, { timeout: 20000 });
  await page.locator("canvas").first().waitFor({ timeout: 60000 });
  await page.getByRole("tab", { name: "Peças" }).click();
  await page.getByRole("button", { name: /Só curtidas/ }).click();
  await page.getByRole("button", { name: `Curtir ${likedName}`, pressed: true }).waitFor({ timeout: 10000 });
  return likedName;
});

await step("provador: ?add= no cliente, vestir, manequim, altura/peso, salvar e comprar look", async () => {
  await go("/provador/?add=bone-dad-hat-domingo-preto");
  await page.locator("canvas").first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !location.search.includes("add="), null, { timeout: 10000 });
  const worn = page.getByRole("list", { name: "Peças vestidas" });
  await worn.getByText(/Boné/i).first().waitFor({ timeout: 10000 });

  await page.getByRole("tab", { name: "Peças" }).click();
  const search = page.locator(".pv-panel__body input[type=search], .pv-panel__body input[placeholder^='Buscar']").first();
  await search.fill("jaqueta varsity");
  await page.getByRole("button", { name: /^Vestir Jaqueta Varsity/ }).first().click();
  await worn.getByText(/Varsity/i).first().waitFor({ timeout: 10000 });

  const group = page.getByRole("group", { name: "Manequim" }).first();
  const before = await group.locator('[aria-pressed="true"]').innerText().catch(() => "");
  await page.getByRole("button", { name: /^(Próximo manequim|KAUÃ|MIA)$/ }).filter({ hasNotText: before }).first().click();
  await page.waitForTimeout(400);
  const after = await group.locator('[aria-pressed="true"]').innerText().catch(() => "");
  expect(before !== after, `manequim não trocou (${before})`);

  await page.getByRole("tab", { name: "Corpo" }).click();
  const ranges = page.locator('.pv-panel__body input[type="range"]');
  await ranges.nth(0).fill("188");
  await ranges.nth(1).fill("92");
  expect((await ranges.nth(0).inputValue()) === "188" && (await ranges.nth(1).inputValue()) === "92", "altura/peso não aplicados");
  await page.waitForTimeout(1500);
  await shot(page, "10-provador-1440", false);

  await page.getByRole("button", { name: /^Salvar$/ }).click();
  await page.locator("#pv-save input").fill("Look da demo");
  await page.getByRole("button", { name: "Salvar look" }).click();
  await page.getByText("“Look da demo” salvo.").waitFor({ timeout: 10000 });

  const bag0 = await bagCount();
  await page.getByRole("button", { name: "Comprar look" }).click();
  await page.waitForFunction((n) => Number((document.querySelector('button[aria-label^="Sacola"]')?.getAttribute("aria-label") ?? "").match(/\d+/)?.[0]) > n, bag0, { timeout: 15000 });
  const bag1 = await bagCount();
  return `${before} → ${after}; 188 cm / 92 kg; look salvo; sacola ${bag0} → ${bag1}`;
});

await step("provador: look salvo persiste e abre por ?look=", async () => {
  const looks = await page.evaluate(() => JSON.parse(localStorage.getItem("kk-demo:v1:looks") ?? "[]"));
  expect(looks.length === 1 && looks[0].name === "Look da demo", "look não está no localStorage");
  await go(`/provador/?look=${looks[0].id}`);
  await page.locator("canvas").first().waitFor({ timeout: 60000 });
  await page.getByRole("tab", { name: "Looks" }).click();
  await page.getByRole("button", { name: /Look da demo/, pressed: true }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);
  await shot(page, "11-provador-look-salvo-1440", false);
});

await step("/entrar e /admin (páginas de aviso)", async () => {
  await go("/entrar/");
  expect((await page.locator("h1").innerText()).includes("Login fica na versão com servidor"), "h1 de /entrar");
  expect(await page.getByRole("link", { name: "Código no GitHub" }).count(), "link do repositório");
  await shot(page, "12-entrar-1440");
  await go("/admin/");
  expect((await page.locator("h1").innerText()).includes("painel"), "h1 de /admin");
});

await step("404 próprio", async () => {
  const res = await page.goto(`${BASE}/nao-existe/`, { waitUntil: "networkidle" });
  expect(res?.status() === 404, `status ${res?.status()}`);
  expect((await page.locator("h1").innerText()).includes("Bola fora"), "h1 do 404");
  await shot(page, "13-404-1440");
});

await step("SEO: sitemap, robots, llms.txt com /site-ecommerce", async () => {
  const get = async (p) => (await page.request.get(`${BASE}${p}`)).text();
  const sitemap = await get("/sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length > 40 && locs.every((l) => l.startsWith("https://walter-maia.github.io/site-ecommerce/")), "URL do sitemap sem /site-ecommerce");
  const robots = await get("/robots.txt");
  expect(robots.includes("Sitemap: https://walter-maia.github.io/site-ecommerce/sitemap.xml"), "robots sem sitemap absoluto");
  const llms = await get("/llms.txt");
  expect(llms.includes("https://walter-maia.github.io/site-ecommerce/produto/"), "llms.txt sem URLs absolutas");
  return `${locs.length} URLs no sitemap`;
});

/* ───────────── celular (390) ───────────── */

const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await mob.newPage();
watch(m);
const mgo = (p) => m.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 60000 });

await step("390: home, menu, listagem, PDP, sacola, provador, entrar, 404", async () => {
  await mgo("/");
  await shotSections(m, "20-home-390", HOME_ANCHORS);
  await m.evaluate(() => window.scrollTo(0, 0));
  await m.getByRole("button", { name: "Abrir menu" }).click();
  await m.waitForTimeout(800);
  await shot(m, "21-menu-390", false);
  await m.keyboard.press("Escape");
  await mgo("/categoria/moletons/?genero=feminino");
  await shot(m, "22-categoria-moletons-feminino-390");
  await mgo("/produto/jaqueta-varsity-bordo-creme/");
  await m.locator('fieldset input[name="tamanho"]:not([disabled]) + label').first().click();
  await m.getByRole("button", { name: /Adicionar ao carrinho/ }).click();
  await m.getByRole("dialog").filter({ hasText: "Finalizar compra" }).first().waitFor({ state: "visible", timeout: 15000 });
  await m.waitForTimeout(600);
  await shot(m, "23-pdp-sacola-390", false);
  await mgo("/carrinho/");
  await shot(m, "24-carrinho-390");
  await mgo("/provador/");
  await m.locator("canvas").first().waitFor({ timeout: 60000 });
  await m.waitForTimeout(2000);
  await shot(m, "25-provador-390", false);
  await mgo("/entrar/");
  await shot(m, "26-entrar-390");
  await m.goto(`${BASE}/nao-existe/`, { waitUntil: "networkidle" });
  await shot(m, "27-404-390");
});

await browser.close();

/* ───────────── relatório ───────────── */

const csp = problems.console.filter((c) => /Content Security Policy/i.test(c));
console.log("\nRESULTADOS");
for (const r of results) console.log(`${r.status === "ok" ? "✔" : "✘"} ${r.name}${r.note ? ` — ${r.note}` : ""}`);
const section = (title, list) => console.log(`\n${title}: ${list.length}${list.length ? "\n  " + [...new Set(list)].slice(0, 30).join("\n  ") : ""}`);
section("Respostas >= 400 (fora o 404 proposital)", problems.badResponses);
section("Requisições com falha", problems.failedRequests);
section("Erros de console", problems.console);
section("Violações de CSP", csp);
section("Exceções de página", problems.pageErrors);
const failed = results.filter((r) => r.status !== "ok").length + problems.badResponses.length + problems.pageErrors.length + csp.length;
process.exit(failed ? 1 : 0);
