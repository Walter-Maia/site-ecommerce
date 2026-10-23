import "server-only";
import { randomUUID } from "node:crypto";

export const nowIso = () => new Date().toISOString();
export const newId = () => randomUUID();

/** Minúsculas sem acento, para busca. */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Escapa curingas do LIKE (usar com `ESCAPE '\'`). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
