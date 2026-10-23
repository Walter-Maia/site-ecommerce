import "server-only";
import type { LookBodySettings, LookItem, SavedLook } from "@/lib/types";
import { all, get } from "./db/client";
import { getOwner, ownerColumn, type Owner } from "./session";
import { parseJson } from "./util";

interface LookRow {
  id: string;
  name: string;
  body: string;
  items: string;
  created_at: string;
}

function toLook(r: LookRow): SavedLook {
  return {
    id: r.id,
    name: r.name,
    body: parseJson<LookBodySettings>(r.body, {} as LookBodySettings),
    items: parseJson<LookItem[]>(r.items, []),
    createdAt: r.created_at,
  };
}

export function looksFor(owner: Owner): SavedLook[] {
  return all<LookRow>(
    `SELECT id, name, body, items, created_at FROM looks WHERE ${ownerColumn(owner)} = ? ORDER BY created_at DESC`,
    owner.id,
  ).map(toLook);
}

/** CONTRATO. Looks salvos pelo visitante no provador. */
export async function listSavedLooks(): Promise<SavedLook[]> {
  const owner = await getOwner();
  return owner ? looksFor(owner) : [];
}

/** Um look salvo, só se pertencer ao visitante atual (para /provador?look=<id>). */
export async function getSavedLook(id: string): Promise<SavedLook | null> {
  const owner = await getOwner();
  if (!owner || typeof id !== "string" || id.length > 64) return null;
  const row = get<LookRow>(
    `SELECT id, name, body, items, created_at FROM looks WHERE id = ? AND ${ownerColumn(owner)} = ?`,
    id,
    owner.id,
  );
  return row ? toLook(row) : null;
}
