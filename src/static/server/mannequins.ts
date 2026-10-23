import { MANNEQUIN_PRESETS } from "@/data/mannequins";
import type { MannequinPreset } from "@/lib/types";

/** Demo estática: CONTRATO de src/server/mannequins.ts lido de src/data (sem SQLite). */
export async function listMannequins(opts: { includeInactive?: boolean } = {}): Promise<MannequinPreset[]> {
  return MANNEQUIN_PRESETS.filter((m) => opts.includeInactive || m.active).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

export async function getMannequin(id: string): Promise<MannequinPreset | null> {
  if (typeof id !== "string" || id.length > 64) return null;
  return MANNEQUIN_PRESETS.find((m) => m.id === id) ?? null;
}
