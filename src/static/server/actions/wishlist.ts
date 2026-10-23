import type { ActionResult } from "@/lib/types";
import { readWishlist, writeWishlist } from "../../client/storage";
import { catalogById, ID_RE } from "./catalog-client";

const MAX_WISHLIST = 200;

/** Demo estática: CONTRATO de src/server/actions/wishlist.ts com as curtidas no localStorage. */
export async function toggleWishlist(input: { productId: string }): Promise<ActionResult<{ liked: boolean; productIds: string[] }>> {
  const productId = input?.productId;
  if (!ID_RE.test(String(productId)) || !(await catalogById()).has(productId)) return { ok: false, error: "Produto inválido." };
  const ids = readWishlist();
  if (ids.includes(productId)) {
    const next = ids.filter((id) => id !== productId);
    writeWishlist(next);
    return { ok: true, data: { liked: false, productIds: next } };
  }
  if (ids.length >= MAX_WISHLIST) return { ok: false, error: "Você atingiu o limite de curtidas." };
  const next = [...ids, productId];
  writeWishlist(next);
  return { ok: true, data: { liked: true, productIds: next } };
}
