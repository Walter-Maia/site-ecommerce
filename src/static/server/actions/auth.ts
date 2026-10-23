/**
 * Demo estática: CONTRATO de src/server/actions/auth.ts. Login e cadastro
 * exigem servidor (scrypt, sessão em cookie httpOnly, rate limit) e só
 * existem na versão completa; aqui /entrar e /cadastro são páginas
 * informativas e estas ações nunca gravam nada.
 */
export type FormState = { error?: string; fieldErrors?: Record<string, string>; success?: boolean } | undefined;

const UNAVAILABLE = "Login e cadastro só funcionam na versão completa, com servidor. Esta é a demonstração estática.";

/** Mesma assinatura de uso do servidor (prev, formData); os argumentos são ignorados. */
export async function loginAction(): Promise<FormState> {
  return { error: UNAVAILABLE };
}

export async function registerAction(): Promise<FormState> {
  return { error: UNAVAILABLE };
}

export async function logoutAction(): Promise<void> {}
