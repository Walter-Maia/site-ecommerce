import "server-only";
import { all } from "./db/client";
import { getOwner, ownerColumn, type Owner } from "./session";

export function wishlistIdsFor(owner: Owner): string[] {
  return all<{ product_id: string }>(
    `SELECT product_id FROM wishlist WHERE ${ownerColumn(owner)} = ? ORDER BY created_at ASC`,
    owner.id,
  ).map((r) => r.product_id);
}

/** CONTRATO. IDs dos produtos curtidos pelo visitante. */
export async function getWishlistProductIds(): Promise<string[]> {
  const owner = await getOwner();
  return owner ? wishlistIdsFor(owner) : [];
}
