"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { get, run, transaction } from "../db/client";
import { getOwner, ownerColumn } from "../session";
import { nowIso } from "../util";
import { idSchema } from "../validation";
import { wishlistIdsFor } from "../wishlist";

const MAX_WISHLIST = 200;
const schema = z.object({ productId: idSchema });

/** CONTRATO. Curtir/descurtir uma peça (alimenta a aba "Curtidas" do provador). */
export async function toggleWishlist(input: { productId: string }): Promise<ActionResult<{ liked: boolean; productIds: string[] }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Produto inválido." };
  const { productId } = parsed.data;
  if (!get<{ id: string }>("SELECT id FROM products WHERE id = ?", productId)) return { ok: false, error: "Produto inválido." };

  const owner = (await getOwner({ create: true }))!;
  const col = ownerColumn(owner);
  let liked = false;
  let limitHit = false;
  transaction(() => {
    const removed = run(`DELETE FROM wishlist WHERE ${col} = ? AND product_id = ?`, owner.id, productId).changes;
    if (removed > 0) return;
    const count = get<{ n: number }>(`SELECT COUNT(*) AS n FROM wishlist WHERE ${col} = ?`, owner.id)?.n ?? 0;
    if (count >= MAX_WISHLIST) {
      limitHit = true;
      return;
    }
    run(`INSERT INTO wishlist (${col}, product_id, created_at) VALUES (?, ?, ?)`, owner.id, productId, nowIso());
    liked = true;
  });
  if (limitHit) return { ok: false, error: "Você atingiu o limite de curtidas." };
  refresh();
  return { ok: true, data: { liked, productIds: wishlistIdsFor(owner) } };
}
