import "server-only";
import type { User } from "@/lib/types";
import { all, run } from "../db/client";
import { getClientIp } from "../auth/request";
import { hashIp } from "../auth/tokens";
import { nowIso } from "../util";

/** Trilha de auditoria: quem (admin), o quê, em qual entidade, quando, de onde (IP pseudonimizado). */
export async function audit(actor: User, action: string, entity: string, entityId: string | null, details?: unknown) {
  const ip = await getClientIp().catch(() => "desconhecido");
  run(
    `INSERT INTO audit_log (actor_user_id, actor_email, action, entity, entity_id, details, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    actor.id,
    actor.email,
    action,
    entity,
    entityId,
    details === undefined ? null : JSON.stringify(details).slice(0, 4000),
    hashIp(ip),
    nowIso(),
  );
}

export interface AuditEntry {
  id: number;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
}

export function recentAudit(limit = 15): AuditEntry[] {
  return all<{ id: number; actor_email: string | null; action: string; entity: string; entity_id: string | null; created_at: string }>(
    "SELECT id, actor_email, action, entity, entity_id, created_at FROM audit_log ORDER BY id DESC LIMIT ?",
    Math.min(100, Math.max(1, limit)),
  ).map((r) => ({ id: r.id, actorEmail: r.actor_email, action: r.action, entity: r.entity, entityId: r.entity_id, createdAt: r.created_at }));
}
