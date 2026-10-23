// Captura de tela para QA visual (usa o Chrome instalado, sem baixar navegador).
// Uso: node scripts/qa/shot.mjs <url> <saida.png> [largura] [altura] [esperaMs] [fullPage:0|1]
import { chromium } from "playwright-core";

const [url, out, w = "1440", h = "900", wait = "1500", full = "0"] = process.argv.slice(2);
if (!url || !out) {
  console.error("uso: node scripts/qa/shot.mjs <url> <saida.png> [w] [h] [esperaMs] [fullPage]");
  process.exit(1);
}
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
if (full === "1") {
  // Captura da página inteira: seções com content-visibility: auto (.cv-auto) fora da viewport não são
  // pintadas e sairiam em branco; aqui todas renderizam, e os reveals ([data-reveal]) aparecem já revelados.
  await page.addStyleTag({ content: ".cv-auto { content-visibility: visible !important; }" });
  await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-in", "")));
}
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();
if (errors.length) console.log("ERROS NO CONSOLE:\n" + errors.join("\n"));
console.log("ok:", out);
