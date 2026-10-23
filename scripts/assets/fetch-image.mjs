// Baixa uma imagem gerada (HTTPS) e grava em WebP no tamanho final.
// Uso: node scripts/assets/fetch-image.mjs <url> <saida.webp> <largura> <altura> [posicao=attention] [qualidade=82]
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const [url, out, w, h, position = "attention", quality = "82"] = process.argv.slice(2);
if (!url?.startsWith("https://") || !out || !w || !h) {
  console.error("uso: fetch-image.mjs <https-url> <saida.webp> <w> <h> [posicao] [qualidade]");
  process.exit(1);
}
const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar`);
const buf = Buffer.from(await res.arrayBuffer());
await mkdir(dirname(out), { recursive: true });
const info = await sharp(buf)
  .rotate()
  .resize(Number(w), Number(h), { fit: "cover", position: sharp.strategy[position] ?? position })
  .webp({ quality: Number(quality), effort: 5 })
  .toFile(out);
console.log(`ok ${out} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`);
