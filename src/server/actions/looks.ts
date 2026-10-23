"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult, LookBodySettings, LookItem, SavedLook } from "@/lib/types";
import { all, get, run } from "../db/client";
import { getOwner, ownerColumn } from "../session";
import { newId, nowIso } from "../util";
import { saveLookSchema } from "../validation";

const MAX_LOOKS = 50;

/** CONTRATO. Salvar/apagar looks montados no provador. */
export async function saveLook(input: { name: string; body: LookBodySettings; items: LookItem[] }): Promise<ActionResult<SavedLook>> {
  const parsed = saveLookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Look inválido." };
  const { name, body, items } = parsed.data;

  // Só peças/tamanhos que existem no catálogo.
  if (items.length) {
    const valid = all<{ product_id: string; size: string }>(
      "SELECT product_id, size FROM product_sizes WHERE product_id IN (SELECT value FROM json_each(?))",
      JSON.stringify(items.map((i) => i.productId)),
    );
    const ok = items.every((i) => valid.some((v) => v.product_id === i.productId && v.size === i.size));
    if (!ok) return { ok: false, error: "O look tem peças ou tamanhos inválidos." };
  }

  const owner = (await getOwner({ create: true }))!;
  const col = ownerColumn(owner);
  const count = get<{ n: number }>(`SELECT COUNT(*) AS n FROM looks WHERE ${col} = ?`, owner.id)?.n ?? 0;
  if (count >= MAX_LOOKS) return { ok: false, error: `Limite de ${MAX_LOOKS} looks salvos. Apague algum para salvar outro.` };

  const look: SavedLook = { id: newId(), name, body, items, createdAt: nowIso() };
  run(
    `INSERT INTO looks (id, ${col}, name, body, items, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    look.id,
    owner.id,
    look.name,
    JSON.stringify(look.body),
    JSON.stringify(look.items),
    look.createdAt,
  );
  refresh();
  return { ok: true, data: look };
}

export async function deleteLook(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  const owner = await getOwner();
  if (parsed.success && owner) {
    // Filtra pelo dono: um id de outra pessoa simplesmente não apaga nada (sem IDOR).
    run(`DELETE FROM looks WHERE id = ? AND ${ownerColumn(owner)} = ?`, parsed.data.id, owner.id);
    refresh();
  }
  return { ok: true, data: undefined };
}
