import { orderLooks, savedLookToGrid } from "@/components/provador/looks";
import type { ProvadorData } from "@/components/provador/types";
import { readSavedLooks, readWishlist } from "./storage";

/** Mesmas validações da página /provador do servidor para ?look= e ?add=. */
const LOOK_ID = /^[a-z0-9-]{1,64}$/i;
const SLUG = /^[a-z0-9-]{1,96}$/;

/**
 * Demo estática: o que a página /provador recebe do servidor por requisição
 * (curtidas, looks salvos, ?look=, ?add=) vem do navegador. Chamado uma vez,
 * ao hidratar o FittingRoom.
 */
export function staticProvadorBoot(data: ProvadorData): { data: ProvadorData; lookId?: string; addSlug?: string } {
  const ids = new Set(data.products.map((p) => p.id));
  const saved = readSavedLooks(); // do mais novo para o mais antigo
  const looks = orderLooks([
    ...data.looks.filter((l) => l.kind === "curated"),
    ...saved.map((l, i) => savedLookToGrid(l, saved.length - i, ids)).filter((l) => l.items.length > 0),
  ]);
  let lookId: string | undefined;
  let addSlug: string | undefined;
  try {
    const sp = new URLSearchParams(window.location.search);
    const look = sp.get("look");
    const add = sp.get("add");
    lookId = look && LOOK_ID.test(look) ? look : undefined;
    addSlug = add && SLUG.test(add) ? add : undefined;
  } catch {
    /* sem URL legível: segue sem pré-carregar */
  }
  return { data: { ...data, looks, wishlist: readWishlist().filter((id) => ids.has(id)) }, lookId, addSlug };
}
