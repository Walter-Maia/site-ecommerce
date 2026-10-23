import type { SavedLook } from "@/lib/types";

/** Demo estática: CONTRATO de src/server/looks.ts. Looks salvos vivem no localStorage (o provador os lê no cliente). */
export async function listSavedLooks(): Promise<SavedLook[]> {
  return [];
}

export async function getSavedLook(id: string): Promise<SavedLook | null> {
  void id;
  return null;
}
