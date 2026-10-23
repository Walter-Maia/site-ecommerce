import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => {
  process.env.QUADRA_DB_PATH = ":memory:";
  process.env.SESSION_SECRET = "teste-segredo-com-mais-de-32-caracteres!!";
  const store = new Map<string, string>();
  return {
    store,
    jar: {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      has: (name: string) => store.has(name),
      set: (name: string, value: string) => (value === "" ? store.delete(name) : store.set(name, value)),
      delete: (name: string) => store.delete(name),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ctx.jar, headers: async () => new Headers({ "x-forwarded-for": "192.0.2.50" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { loginAction } from "@/server/actions/auth";
import { addToCart, removeCartLine, updateCartLine } from "@/server/actions/cart";
import { deleteLook, saveLook } from "@/server/actions/looks";
import { toggleWishlist } from "@/server/actions/wishlist";
import { SESSION_COOKIE, VISITOR_COOKIE } from "@/server/auth/cookie-config";
import { hashPassword } from "@/server/auth/password";
import { getCart } from "@/server/cart";
import { placeOrder } from "@/server/checkout";
import { get, run } from "@/server/db/client";
import { listSavedLooks } from "@/server/looks";
import { getOrderForCurrentVisitor } from "@/server/orders";
import { getOwner } from "@/server/session";
import { checkoutSchema } from "@/server/validation";
import { getWishlistProductIds } from "@/server/wishlist";

const body = { mannequinId: "m-mia", heightCm: 166, weightKg: 58, skinTone: "#B57A55", hairColor: "#1C1412", hairStyle: "coque" as const, style: "informal" as const };
const address = checkoutSchema.parse({
  name: "Bia Lima", email: "bia@ex.com", cep: "01310100", street: "Rua A", number: "1", district: "Centro", city: "São Paulo", state: "SP", paymentMethod: "cartao",
});

beforeAll(async () => {
  const now = new Date().toISOString();
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES ('u-bia', 'Bia', 'bia@ex.com', ?, 'cliente', ?, ?)",
    await hashPassword("senha-da-bia-forte-1"), now, now,
  );
  run("UPDATE product_sizes SET stock = 50");
});
beforeEach(() => ctx.store.clear());

const loginForm = () => {
  const fd = new FormData();
  fd.set("email", "bia@ex.com");
  fd.set("password", "senha-da-bia-forte-1");
  return fd;
};

describe("convidado → conta", () => {
  it("carrinho, curtidas e looks do convidado passam para a conta no login", async () => {
    expect((await addToCart({ productId: "p01", size: "M", quantity: 2 })).ok).toBe(true);
    expect(ctx.store.get(VISITOR_COOKIE)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await toggleWishlist({ productId: "p03" });
    const look = await saveLook({ name: "Meu drop", body, items: [{ productId: "p01", size: "M" }] });
    expect(look.ok).toBe(true);
    const visitor = (await getOwner())!;
    expect(visitor.kind).toBe("visitor");

    await expect(loginAction(undefined, loginForm())).rejects.toThrow("NEXT_REDIRECT:/conta");
    expect(ctx.store.has(SESSION_COOKIE)).toBe(true);

    const cart = await getCart();
    expect(cart.lines.map((l) => [l.productId, l.size, l.quantity])).toEqual([["p01", "M", 2]]);
    expect(await getWishlistProductIds()).toEqual(["p03"]);
    expect((await listSavedLooks()).map((l) => l.name)).toEqual(["Meu drop"]);
    expect(get("SELECT 1 AS x FROM cart_items WHERE visitor_id = ?", visitor.id)).toBeUndefined();
  });

  it("preço vem do banco: o cliente não consegue mandar preço nem quantidade absurda", async () => {
    const r = await addToCart({ productId: "p01", size: "M", quantity: 999 } as never);
    expect(r.ok).toBe(false);
    const ok = await addToCart({ productId: "p01", size: "G", price: 1 } as never);
    expect(ok.ok && ok.data.lines.find((l) => l.size === "G")?.unitPrice).toBe(get<{ price: number }>("SELECT price FROM products WHERE id = 'p01'")!.price);
    expect((await addToCart({ productId: "nao-existe", size: "M" })).ok).toBe(false);
    expect((await addToCart({ productId: "p01", size: "37" as never })).ok).toBe(false);
  });
});

describe("IDOR: dados só do próprio dono", () => {
  it("outro visitante não altera nem remove a linha do carrinho alheio", async () => {
    const a = await addToCart({ productId: "p02", size: "M" });
    const lineId = a.ok ? a.data.lines[0].lineId : "";
    ctx.store.clear(); // outro navegador
    await addToCart({ productId: "p04", size: "M" });
    expect((await updateCartLine({ lineId, quantity: 5 })).ok).toBe(false);
    await removeCartLine({ lineId });
    expect(get<{ quantity: number }>("SELECT quantity FROM cart_items WHERE id = ?", lineId)?.quantity).toBe(1);
  });

  it("deleteLook com id de outra pessoa não apaga nada", async () => {
    const saved = await saveLook({ name: "Do A", body, items: [] });
    const id = saved.ok ? saved.data.id : "";
    ctx.store.clear();
    await saveLook({ name: "Do B", body, items: [] });
    await deleteLook({ id });
    expect(get("SELECT 1 AS x FROM looks WHERE id = ?", id)).toBeDefined();
  });

  it("pedido de convidado só abre no navegador que o criou; pedido logado só na conta", async () => {
    await addToCart({ productId: "p05", size: "M" });
    const guestOwner = (await getOwner())!;
    const guestCookie = ctx.store.get(VISITOR_COOKIE)!;
    const { id } = placeOrder(guestOwner, address);
    expect((await getOrderForCurrentVisitor(id))?.id).toBe(id);
    expect((await getOrderForCurrentVisitor(id))?.lines[0].unitPrice).toBeGreaterThan(0);

    ctx.store.clear(); // outro navegador, sem cookie
    expect(await getOrderForCurrentVisitor(id)).toBeNull();
    await addToCart({ productId: "p05", size: "M" }); // outro convidado com cookie próprio
    expect(await getOrderForCurrentVisitor(id)).toBeNull();
    expect(await getOrderForCurrentVisitor("nao-e-uuid")).toBeNull();

    // Pedido feito logado: o cookie de convidado do mesmo navegador não basta.
    ctx.store.clear();
    ctx.store.set(VISITOR_COOKIE, guestCookie);
    await expect(loginAction(undefined, loginForm())).rejects.toThrow(/NEXT_REDIRECT/);
    await addToCart({ productId: "p06", size: "M" });
    const userOrder = placeOrder((await getOwner())!, address);
    expect((await getOrderForCurrentVisitor(userOrder.id))?.id).toBe(userOrder.id);
    ctx.store.delete(SESSION_COOKIE);
    expect(await getOrderForCurrentVisitor(userOrder.id)).toBeNull();
  });
});
