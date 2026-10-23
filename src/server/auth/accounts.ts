import "server-only";
import type { User } from "@/lib/types";
import { all, get, run, transaction } from "../db/client";
import { MAX_CART_LINES, MAX_QTY_PER_LINE } from "../pricing";
import { newId, nowIso } from "../util";

interface UserWithHash extends User {
  password_hash: string;
}

/** Uso interno da autenticação: inclui o hash, nunca sai do servidor. */
export function findUserForLogin(email: string): UserWithHash | undefined {
  return get<UserWithHash>("SELECT id, name, email, role, password_hash FROM users WHERE email = ?", email);
}

export function emailExists(email: string): boolean {
  return !!get<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
}

/** Cria cliente. Devolve false se o e-mail já existe (inclusive em corrida). */
export function createCustomer(input: { name: string; email: string; passwordHash: string }): boolean {
  const now = nowIso();
  try {
    run(
      "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'cliente', ?, ?)",
      newId(),
      input.name,
      input.email,
      input.passwordHash,
      now,
      now,
    );
    return true;
  } catch (err) {
    if (String((err as Error).message).includes("UNIQUE")) return false;
    throw err;
  }
}

export function recordAttempt(kind: "login" | "register", email: string | null, ipHash: string | null, success: boolean, reason?: string) {
  run(
    "INSERT INTO login_attempts (kind, email, ip_hash, success, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    kind,
    email ? email.slice(0, 254) : null,
    ipHash,
    success ? 1 : 0,
    reason ?? null,
    nowIso(),
  );
}

/**
 * Ao entrar, o carrinho/curtidas/looks do convidado passam para a conta.
 * Pedidos de convidado feitos neste navegador com o mesmo e-mail também.
 */
export function mergeVisitorIntoUser(visitorId: string, userId: string, email: string) {
  transaction(() => {
    const now = nowIso();
    const guestLines = all<{ id: string; product_id: string; size: string; quantity: number }>(
      "SELECT id, product_id, size, quantity FROM cart_items WHERE visitor_id = ? ORDER BY created_at",
      visitorId,
    );
    let lineCount = get<{ n: number }>("SELECT COUNT(*) AS n FROM cart_items WHERE user_id = ?", userId)?.n ?? 0;
    for (const l of guestLines) {
      const existing = get<{ id: string; quantity: number }>(
        "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?",
        userId,
        l.product_id,
        l.size,
      );
      if (existing) {
        run(
          "UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?",
          Math.min(MAX_QTY_PER_LINE, existing.quantity + l.quantity),
          now,
          existing.id,
        );
      } else if (lineCount < MAX_CART_LINES) {
        run(
          "INSERT INTO cart_items (id, user_id, product_id, size, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          newId(),
          userId,
          l.product_id,
          l.size,
          l.quantity,
          now,
          now,
        );
        lineCount++;
      }
    }
    run("DELETE FROM cart_items WHERE visitor_id = ?", visitorId);

    run(
      "INSERT OR IGNORE INTO wishlist (user_id, product_id, created_at) SELECT ?, product_id, created_at FROM wishlist WHERE visitor_id = ?",
      userId,
      visitorId,
    );
    run("DELETE FROM wishlist WHERE visitor_id = ?", visitorId);

    run("UPDATE looks SET user_id = ?, visitor_id = NULL WHERE visitor_id = ?", userId, visitorId);

    run(
      "UPDATE orders SET user_id = ?, updated_at = ? WHERE visitor_id = ? AND user_id IS NULL AND email = ? COLLATE NOCASE",
      userId,
      now,
      visitorId,
      email,
    );
  });
}
