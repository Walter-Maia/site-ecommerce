import type { FormState } from "./auth";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Demo estática: CONTRATO de src/server/actions/newsletter.ts. Valida o e-mail
 * e confirma; nada é enviado nem guardado (não há servidor nem lista real).
 */
export async function subscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) return { error: "Informe um e-mail válido.", fieldErrors: { email: "Informe um e-mail válido." } };
  return { success: true };
}
