"use server";
import type { FormState } from "./auth";
import { limiter, retryMessage } from "../auth/rate-limit";
import { getClientIp } from "../auth/request";
import { run } from "../db/client";
import { nowIso } from "../util";
import { emailSchema } from "../validation";

/**
 * CONTRATO. Inscrição na lista "Seja membro". Campo do form: email.
 * Resposta idêntica para e-mail novo ou já inscrito (sem enumeração).
 */
export async function subscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Informe um e-mail válido.", fieldErrors: { email: "Informe um e-mail válido." } };

  const ip = await getClientIp();
  const byIp = limiter("newsletterIp").hit(ip);
  const byEmail = limiter("newsletterEmail").hit(parsed.data);
  if (byIp.limited || byEmail.limited) return { error: retryMessage(Math.max(byIp.retryAfterMs, byEmail.retryAfterMs)) };

  run("INSERT OR IGNORE INTO newsletter (email, created_at) VALUES (?, ?)", parsed.data, nowIso());
  return { success: true };
}
