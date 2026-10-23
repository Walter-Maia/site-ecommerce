import type { ActionResult, LookBodySettings, LookItem, SavedLook } from "@/lib/types";
import { BODY_LIMITS } from "@/lib/types";
import { newId, readSavedLooks, writeSavedLooks } from "../../client/storage";
import { catalogById, ID_RE, UUID_RE } from "./catalog-client";

/** Demo estática: CONTRATO de src/server/actions/looks.ts com os looks no localStorage. */

const MAX_LOOKS = 50;
const HEX = /^#[0-9a-fA-F]{6}$/;
const HAIR = new Set(["raspado", "curto", "cacheado-curto", "black-power", "trancas", "maria-chiquinha", "coque", "rabo-de-cavalo", "longo-liso"]);
const CONTROL = /[\u0000-\u001f\u007f]/;
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

function validBody(b: LookBodySettings | undefined): b is LookBodySettings {
  return (
    !!b &&
    ID_RE.test(String(b.mannequinId)) &&
    int(b.heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max) &&
    int(b.weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max) &&
    HEX.test(String(b.skinTone)) &&
    HEX.test(String(b.hairColor)) &&
    HAIR.has(String(b.hairStyle)) &&
    (b.style === "formal" || b.style === "informal")
  );
}

export async function saveLook(input: { name: string; body: LookBodySettings; items: LookItem[] }): Promise<ActionResult<SavedLook>> {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const items = Array.isArray(input?.items) ? input.items : null;
  if (name.length > 40 || CONTROL.test(name) || !validBody(input?.body) || !items || items.length > 12) return { ok: false, error: "Look inválido." };

  // Só peças/tamanhos que existem no catálogo.
  const byId = await catalogById();
  const valid = items.every((i) => byId.get(i?.productId)?.sizes.some((s) => s.size === i.size));
  if (!valid) return { ok: false, error: "O look tem peças ou tamanhos inválidos." };

  const looks = readSavedLooks();
  if (looks.length >= MAX_LOOKS) return { ok: false, error: `Limite de ${MAX_LOOKS} looks salvos. Apague algum para salvar outro.` };

  const b = input.body;
  const look: SavedLook = {
    id: newId(),
    name: name || "Meu look",
    body: { mannequinId: b.mannequinId, heightCm: b.heightCm, weightKg: b.weightKg, skinTone: b.skinTone, hairColor: b.hairColor, hairStyle: b.hairStyle, style: b.style },
    items: items.map((i) => ({ productId: i.productId, size: i.size })),
    createdAt: new Date().toISOString(),
  };
  if (!writeSavedLooks([look, ...looks])) return { ok: false, error: "Não foi possível salvar neste navegador (armazenamento bloqueado ou cheio)." };
  return { ok: true, data: look };
}

export async function deleteLook(input: { id: string }): Promise<ActionResult> {
  if (UUID_RE.test(String(input?.id))) writeSavedLooks(readSavedLooks().filter((l) => l.id !== input.id));
  return { ok: true, data: undefined };
}
