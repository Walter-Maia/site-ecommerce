import type { SavedLook } from "@/lib/types";
import type { GridLook } from "./types";

/** Look salvo → card da aba LOOKS. `number` é a ordem de criação (MEU · 01 = o mais antigo). */
export function savedLookToGrid(l: SavedLook, number: number, productIds: ReadonlySet<string>): GridLook {
  return {
    id: l.id,
    kind: "saved",
    name: l.name,
    code: `MEU · ${String(number).padStart(2, "0")}`,
    mannequinId: l.body.mannequinId,
    items: l.items.filter((it) => productIds.has(it.productId)).map((it) => ({ productId: it.productId, size: it.size })),
    image: null,
    body: l.body,
  };
}

/** Ordem: prontos → meus looks (estável dentro de cada grupo). */
export function orderLooks(looks: GridLook[]): GridLook[] {
  const rank = (l: GridLook) => (l.kind === "saved" ? 1 : 0);
  return looks.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map((x) => x.l);
}
