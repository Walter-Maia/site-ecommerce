// Permite rodar scripts .ts com Node 24 (type stripping nativo) importando
// módulos de src/ com o alias "@/" e imports sem extensão, como no Next.
// Uso: node --conditions=react-server --import ./scripts/lib/register-ts.mjs scripts/x.ts
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const EXTS = [".ts", ".tsx", `${path.sep}index.ts`];

registerHooks({
  resolve(specifier, context, nextResolve) {
    let url = null;
    if (specifier.startsWith("@/")) url = pathToFileURL(path.join(SRC, specifier.slice(2)));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) url = new URL(specifier, context.parentURL);
    if (url && !path.extname(url.pathname)) {
      const base = fileURLToPath(url);
      for (const ext of EXTS) {
        if (fs.existsSync(base + ext)) return nextResolve(pathToFileURL(base + ext).href, context);
      }
    }
    return nextResolve(url ? url.href : specifier, context);
  },
});
