"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createCustomer, findUserForLogin, mergeVisitorIntoUser, recordAttempt } from "../auth/accounts";
import { SESSION_COOKIE, SESSION_TTL_S, cookieOptions } from "../auth/cookie-config";
import { PASSWORD_MAX, checkPasswordStrength, getDummyHash, hashPassword, verifyPassword } from "../auth/password";
import { limiter, retryMessage } from "../auth/rate-limit";
import { getClientIp } from "../auth/request";
import { createSession, deleteSession, purgeExpiredSessions } from "../auth/sessions";
import { hashIp } from "../auth/tokens";
import { discardVisitor, getVisitorId } from "../auth/visitor";
import { safeNextPath } from "../session";
import { emailSchema, fieldErrors, text } from "../validation";

/** CONTRATO. Estado de formulário para useActionState. */
export type FormState = { error?: string; fieldErrors?: Record<string, string>; success?: boolean } | undefined;

const GENERIC_LOGIN_ERROR = "E-mail ou senha incorretos.";

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase().slice(0, 254) : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  const missing: Record<string, string> = {};
  if (!email) missing.email = "Informe seu e-mail.";
  if (!password) missing.password = "Informe sua senha.";
  if (Object.keys(missing).length) return { error: "Preencha e-mail e senha.", fieldErrors: missing };

  const ip = await getClientIp();
  const ipHash = hashIp(ip);
  const global = limiter("loginGlobal").hit("all");
  const byIp = limiter("loginIp").hit(ip);
  // Conta a tentativa ANTES do scrypt (assíncrono). Com status() aqui e hit() só na
  // falha, requisições paralelas passavam todas pela checagem antes de a 1ª falha ser
  // registrada (≈3x o limite por janela). Login certo zera a janela logo abaixo.
  const byEmail = limiter("loginEmail").hit(email);
  if (global.limited || byIp.limited || byEmail.limited) {
    recordAttempt("login", email, ipHash, false, "rate_limited");
    return { error: retryMessage(Math.max(global.retryAfterMs, byIp.retryAfterMs, byEmail.retryAfterMs)) };
  }

  // Sempre roda o scrypt (hash fictício se o e-mail não existe): mesmo tempo de resposta.
  const user = findUserForLogin(email);
  const candidate = password.length <= PASSWORD_MAX ? password : "";
  const valid = await verifyPassword(candidate, user?.password_hash ?? (await getDummyHash()));

  if (!user || !valid || candidate !== password) {
    recordAttempt("login", email, ipHash, false, user ? "bad_password" : "unknown_email");
    return { error: GENERIC_LOGIN_ERROR };
  }

  limiter("loginEmail").reset(email);
  recordAttempt("login", email, ipHash, true);

  // Rotação: descarta qualquer sessão anterior deste navegador (evita fixação de sessão).
  const jar = await cookies();
  deleteSession(jar.get(SESSION_COOKIE)?.value);
  const token = createSession(user.id);
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_S));

  const visitorId = await getVisitorId();
  if (visitorId) mergeVisitorIntoUser(visitorId, user.id, user.email);
  if (Math.random() < 0.05) purgeExpiredSessions();

  const fallback = user.role === "admin" ? "/admin" : "/conta";
  redirect(safeNextPath(formData.get("next")) ?? fallback);
}

const registerSchema = z.object({
  name: text(2, 80, "Informe seu nome."),
  email: emailSchema,
  password: z.string("Crie uma senha.").max(PASSWORD_MAX, `Use no máximo ${PASSWORD_MAX} caracteres.`),
});

/**
 * Cadastro sem enumeração: a resposta é a mesma se o e-mail já existe
 * (redireciona para /entrar). Em produção, o dono do e-mail receberia um aviso.
 */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const rl = limiter("registerIp").hit(ip);
  if (rl.limited) return { error: retryMessage(rl.retryAfterMs) };

  const parsed = registerSchema.safeParse({
    name: formData.get("name") ?? undefined,
    email: formData.get("email") ?? undefined,
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };

  const { name, email, password } = parsed.data;
  const weak = checkPasswordStrength(password, { email, name });
  if (weak) return { error: "Revise os campos destacados.", fieldErrors: { password: weak } };

  const passwordHash = await hashPassword(password);
  const created = createCustomer({ name, email, passwordHash });
  recordAttempt("register", email, hashIp(ip), created, created ? undefined : "email_exists");

  redirect("/entrar?cadastro=ok");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  deleteSession(jar.get(SESSION_COOKIE)?.value);
  jar.set(SESSION_COOKIE, "", cookieOptions(0));
  await discardVisitor();
  redirect("/");
}
