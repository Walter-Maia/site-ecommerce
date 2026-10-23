import "server-only";
import type { MannequinPreset } from "@/lib/types";
import { all, get } from "./db/client";
import { toMannequin, type MannequinRow } from "./db/mappers";

/** CONTRATO. Manequins do provador (o admin edita em /admin/manequins). Cliente vê só os ativos, na ordem. */
export async function listMannequins(opts: { includeInactive?: boolean } = {}): Promise<MannequinPreset[]> {
  const rows = opts.includeInactive
    ? all<MannequinRow>("SELECT * FROM mannequins ORDER BY sort_order ASC, name ASC")
    : all<MannequinRow>("SELECT * FROM mannequins WHERE active = 1 ORDER BY sort_order ASC, name ASC");
  return rows.map(toMannequin);
}

export async function getMannequin(id: string): Promise<MannequinPreset | null> {
  if (typeof id !== "string" || id.length > 64) return null;
  const row = get<MannequinRow>("SELECT * FROM mannequins WHERE id = ?", id);
  return row ? toMannequin(row) : null;
}
