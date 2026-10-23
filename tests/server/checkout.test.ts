import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.QUADRA_DB_PATH = ":memory:";
  process.env.SESSION_SECRET = "teste-segredo-com-mais-de-32-caracteres!!";
});
vi.mock("server-only", () => ({}));

import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD } from "@/data/site";
import { cartViewFor } from "@/server/cart";
import { CheckoutError, placeOrder } from "@/server/checkout";
import { get, run } from "@/server/db/client";
import { computeTotals, shippingFor } from "@/server/pricing";
import type { Owner } from "@/server/session";
import { checkoutFromForm, checkoutSchema, isValidCpf } from "@/server/validation";

const valid = {
  name: "Ana Paula Souza",
  email: "  Ana@Exemplo.com ",
  cep: "01310-100",
  street: "Av. Paulista",
  number: "1000",
  complement: "",
  district: "Bela Vista",
  city: "São Paulo",
  state: "sp",
  paymentMethod: "pix",
};

describe("validação do checkout (zod)", () => {
  it("aceita e normaliza um endereço válido", () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.cep).toBe("01310100");
    expect(r.data.state).toBe("SP");
    expect(r.data.email).toBe("ana@exemplo.com");
    expect(r.data.complement).toBeUndefined();
  });

  it.each([
    ["cep", "0131010", "8 dígitos"],
    ["cep", "abcdefgh", "8 dígitos"],
    ["state", "XX", "estado"],
    ["email", "ana@", "e-mail"],
    ["name", "A", "nome"],
    ["number", "", "número"],
    ["paymentMethod", "boleto", "pagamento"],
    ["street", "Rua\u0000X", "inválidos"],
  ])("recusa %s = %j", (field, value, msg) => {
    const r = checkoutSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === field);
    expect(issue?.message.toLowerCase()).toContain(msg);
  });

  it("CPF é opcional, mas se vier precisa ser válido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, cpf: "529.982.247-25" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...valid, cpf: "123.456.789-00" }).success).toBe(false);
  });

  it("lê só os campos esperados do form: dados de cartão são ignorados", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valid)) fd.set(k, v);
    fd.set("cardNumber", "4111111111111111");
    fd.set("cvv", "123");
    const obj = checkoutFromForm(fd);
    expect(Object.keys(obj)).not.toContain("cardNumber");
    expect(Object.keys(obj)).not.toContain("cvv");
    expect(JSON.stringify(obj)).not.toContain("4111");
  });
});

describe("cálculo de total e frete", () => {
  it("frete fixo abaixo do limite, grátis a partir dele, zero com carrinho vazio", () => {
    expect(shippingFor(0)).toBe(0);
    expect(shippingFor(FREE_SHIPPING_THRESHOLD - 1)).toBe(FLAT_SHIPPING);
    expect(shippingFor(FREE_SHIPPING_THRESHOLD)).toBe(0);
  });

  it("soma linhas em centavos inteiros", () => {
    const t = computeTotals([
      { unitPrice: 18990, quantity: 1 },
      { unitPrice: 4990, quantity: 2 },
    ]);
    expect(t).toEqual({ subtotal: 28970, shipping: FLAT_SHIPPING, total: 28970 + FLAT_SHIPPING, itemCount: 3 });
    expect(computeTotals([{ unitPrice: 29900, quantity: 1 }]).total).toBe(29900);
  });

  it("recusa preço/quantidade inválidos", () => {
    expect(() => computeTotals([{ unitPrice: -1, quantity: 1 }])).toThrow();
    expect(() => computeTotals([{ unitPrice: 10.5, quantity: 1 }])).toThrow();
    expect(() => computeTotals([{ unitPrice: 100, quantity: 0 }])).toThrow();
  });
});

describe("placeOrder (transação no servidor)", () => {
  const owner: Owner = { kind: "visitor", id: "v1" };
  const data = checkoutSchema.parse(valid);
  const stockOf = (size: string) => get<{ stock: number }>("SELECT stock FROM product_sizes WHERE product_id = 'p01' AND size = ?", size)!.stock;

  function setup() {
    run("DELETE FROM cart_items");
    run("INSERT OR IGNORE INTO visitors (id, token_hash, created_at, last_seen_at, expires_at) VALUES ('v1', 'h1', 'x', 'x', '2999-01-01')");
    run("UPDATE product_sizes SET stock = 5 WHERE product_id = 'p01' AND size = 'M'");
    run("INSERT INTO cart_items (id, visitor_id, product_id, size, quantity, created_at, updated_at) VALUES ('l1', 'v1', 'p01', 'M', 2, 'x', 'x')");
  }

  it("usa o preço ATUAL do banco, baixa estoque e limpa o carrinho", () => {
    setup();
    run("UPDATE products SET price = 12345 WHERE id = 'p01'");
    const { id, number } = placeOrder(owner, data);
    expect(number).toMatch(/^QD-\d{6}$/);
    const order = get<{ subtotal: number; shipping: number; total: number; status: string; visitor_id: string }>(
      "SELECT subtotal, shipping, total, status, visitor_id FROM orders WHERE id = ?",
      id,
    )!;
    expect(order.subtotal).toBe(24690);
    expect(order.shipping).toBe(FLAT_SHIPPING);
    expect(order.total).toBe(24690 + FLAT_SHIPPING);
    expect(order.status).toBe("aguardando-pagamento");
    expect(order.visitor_id).toBe("v1");
    expect(stockOf("M")).toBe(3);
    expect(cartViewFor(owner).lines).toHaveLength(0);
  });

  it("estoque insuficiente aborta tudo (rollback: nada é gravado)", () => {
    setup();
    run("UPDATE product_sizes SET stock = 1 WHERE product_id = 'p01' AND size = 'M'");
    const before = get<{ n: number }>("SELECT COUNT(*) AS n FROM orders")!.n;
    expect(() => placeOrder(owner, data)).toThrow(CheckoutError);
    expect(get<{ n: number }>("SELECT COUNT(*) AS n FROM orders")!.n).toBe(before);
    expect(stockOf("M")).toBe(1);
    expect(cartViewFor(owner).lines).toHaveLength(1);
  });

  it("carrinho vazio não gera pedido", () => {
    run("DELETE FROM cart_items");
    expect(() => placeOrder(owner, data)).toThrow(/vazio/);
  });
});
