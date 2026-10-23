import "server-only";
import { CURATED_LOOKS } from "@/data/mannequins";
import type { MannequinPreset } from "@/lib/types";
import { get, run, transaction } from "../db/client";
import { toMannequin, type MannequinRow } from "../db/mappers";
import { nowIso } from "../util";
import type { MannequinInput } from "./schemas";
import { randomBytes } from "node:crypto";

/** CRUD de manequins. Quem chama DEVE ter passado por requireAdmin(). */

export function getMannequinForAdmin(id: string): MannequinPreset | null {
  const row = get<MannequinRow>("SELECT * FROM mannequins WHERE id = ?", id);
  return row ? toMannequin(row) : null;
}

export function createMannequin(input: MannequinInput): MannequinPreset {
  const id = `m-${randomBytes(5).toString("hex")}`;
  const now = nowIso();
  run(
    `INSERT INTO mannequins (id, name, body, skin_tone, hair_style, hair_color, style, height_cm, weight_kg, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
    input.body,
    input.skinTone.toUpperCase(),
    input.hairStyle,
    input.hairColor.toUpperCase(),
    input.style,
    input.heightCm,
    input.weightKg,
    input.active ? 1 : 0,
    input.sortOrder,
    now,
    now,
  );
  return getMannequinForAdmin(id)!;
}

export function updateMannequin(id: string, input: MannequinInput): { before: MannequinPreset; after: MannequinPreset } | null {
  return transaction(() => {
    const before = getMannequinForAdmin(id);
    if (!before) return null;
    run(
      `UPDATE mannequins SET name = ?, body = ?, skin_tone = ?, hair_style = ?, hair_color = ?, style = ?,
              height_cm = ?, weight_kg = ?, active = ?, sort_order = ?, updated_at = ?
        WHERE id = ?`,
      input.name,
      input.body,
      input.skinTone.toUpperCase(),
      input.hairStyle,
      input.hairColor.toUpperCase(),
      input.style,
      input.heightCm,
      input.weightKg,
      input.active ? 1 : 0,
      input.sortOrder,
      nowIso(),
      id,
    );
    return { before, after: getMannequinForAdmin(id)! };
  });
}

/** Manequins usados pelos looks editoriais não podem ser apagados (só desativados). */
export function mannequinInUse(id: string): boolean {
  return CURATED_LOOKS.some((l) => l.mannequinId === id && !l.locked);
}

export function deleteMannequin(id: string): MannequinPreset | null {
  return transaction(() => {
    const before = getMannequinForAdmin(id);
    if (!before) return null;
    run("DELETE FROM mannequins WHERE id = ?", id);
    return before;
  });
}
