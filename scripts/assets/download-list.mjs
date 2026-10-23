// Baixa uma lista "url<TAB>saida<TAB>w<TAB>h[<TAB>posicao]" (uma por linha) em paralelo limitado.
// Uso: node scripts/assets/download-list.mjs <lista.tsv>
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const lines = (await readFile(process.argv[2], "utf8")).split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
const queue = lines.map((l) => l.split("\t"));
let failed = 0;
async function worker() {
  while (queue.length) {
    const [url, out, w, h, pos = "attention"] = queue.shift();
    try {
      const { stdout } = await run(process.execPath, ["scripts/assets/fetch-image.mjs", url, out, w, h, pos]);
      process.stdout.write(stdout);
    } catch (e) {
      failed++;
      console.error("FALHOU", out, e.message);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(failed ? `${failed} falha(s)` : "tudo ok");
