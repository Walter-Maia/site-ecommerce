import { UFS } from "@/components/loja/constants";
import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD } from "@/data/site";
import { withBasePath } from "@/lib/static-demo";
import { readCartLines, newId, saveOrder, writeCartLines } from "../../client/storage";
import type { OrderView } from "../orders";
import type { FormState } from "./auth";
import { catalogById } from "./catalog-client";

/**
 * Demo estática: CONTRATO de src/server/actions/checkout.ts no navegador.
 * Mesma validação (mesmas mensagens) do checkoutSchema do servidor, preço e
 * estoque relidos do catálogo, pagamento SIMULADO. O pedido vai para o
 * localStorage e a navegação segue para /pedido/?id=<id> (no export estático
 * não existe /pedido/<id> gerado por requisição).
 * Os campos de cartão continuam sem `name`: nunca entram no FormData.
 */

const CONTROL = /[\u0000-\u001f\u007f]/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = "name" | "email" | "cpf" | "cep" | "street" | "number" | "complement" | "district" | "city" | "state" | "paymentMethod";

function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function validate(fd: FormData) {
  const errors: Partial<Record<Field, string>> = {};
  const get = (k: Field) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const text = (k: Field, min: number, max: number, msg: string) => {
    const raw = get(k);
    const v = raw?.trim() ?? "";
    if (raw === undefined || v.length < min) errors[k] = msg;
    else if (v.length > max) errors[k] = `Use no máximo ${max} caracteres.`;
    else if (CONTROL.test(v)) errors[k] = "Caracteres inválidos.";
    return v;
  };

  const name = text("name", 3, 80, "Informe seu nome completo.");
  const email = (get("email") ?? "").trim().toLowerCase();
  if (email.length > 254) errors.email = "E-mail muito longo.";
  else if (!EMAIL.test(email)) errors.email = "Informe um e-mail válido.";
  const cpf = (get("cpf") ?? "").replace(/\D/g, "") || undefined;
  if (get("cpf") && !isValidCpf(get("cpf")!)) errors.cpf = "CPF inválido.";
  const rawCep = get("cep");
  const cep = (rawCep ?? "").replace(/\D/g, "");
  if (rawCep === undefined) errors.cep = "Informe o CEP.";
  else if (cep.length !== 8) errors.cep = "O CEP deve ter 8 dígitos.";
  const street = text("street", 2, 120, "Informe a rua.");
  const number = text("number", 1, 10, "Informe o número.");
  const complement = (get("complement") ?? "").trim();
  if (complement.length > 60) errors.complement = "Use no máximo 60 caracteres.";
  else if (CONTROL.test(complement)) errors.complement = "Caracteres inválidos.";
  const district = text("district", 2, 60, "Informe o bairro.");
  const city = text("city", 2, 60, "Informe a cidade.");
  const state = (get("state") ?? "").trim().toUpperCase();
  if (!(UFS as readonly string[]).includes(state)) errors.state = "Selecione o estado.";
  const paymentMethod = get("paymentMethod");
  if (paymentMethod !== "pix" && paymentMethod !== "cartao") errors.paymentMethod = "Escolha a forma de pagamento.";

  if (Object.keys(errors).length) return { ok: false as const, errors: errors as Record<string, string> };
  return {
    ok: true as const,
    data: { name, email, cpf, cep, street, number, complement: complement || undefined, district, city, state, paymentMethod: paymentMethod as "pix" | "cartao" },
  };
}

/** Igual a formatAddress de src/server/orders.ts. */
function formatAddress(o: { street: string; number: string; complement?: string; district: string; city: string; state: string; cep: string }) {
  const cep = `${o.cep.slice(0, 5)}-${o.cep.slice(5)}`;
  const comp = o.complement ? `, ${o.complement}` : "";
  return `${o.street}, ${o.number}${comp} — ${o.district}, ${o.city}/${o.state} — CEP ${cep}`;
}

export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = validate(formData);
  if (!parsed.ok) return { error: "Revise os campos destacados.", fieldErrors: parsed.errors };

  const stored = readCartLines();
  if (stored.length === 0) return { error: "Seu carrinho está vazio." };

  const byId = await catalogById();
  const lines: OrderView["lines"] = [];
  for (const l of stored) {
    const p = byId.get(l.productId);
    const stock = p?.sizes.find((s) => s.size === l.size)?.stock ?? 0;
    if (!p || stock < l.quantity) {
      const name = p?.name ?? l.name;
      return {
        error:
          stock === 0
            ? `${name} (tam. ${l.size}) esgotou. Remova do carrinho para continuar.`
            : `${name} (tam. ${l.size}): só ${stock} em estoque. Ajuste a quantidade.`,
      };
    }
    lines.push({ name: p.name, slug: p.slug, image: p.images[0]?.src ?? "", size: l.size, quantity: l.quantity, unitPrice: p.price, lineTotal: p.price * l.quantity });
  }

  const d = parsed.data;
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const order: OrderView = {
    id: newId(),
    number: `QD-${100000 + Math.floor(Math.random() * 900000)}`,
    // Pagamento SIMULADO: cartão "aprovado" na hora; Pix fica aguardando (igual ao servidor).
    status: d.paymentMethod === "cartao" ? "pago" : "aguardando-pagamento",
    paymentMethod: d.paymentMethod,
    createdAt: new Date().toISOString(),
    customerName: d.name,
    email: d.email,
    shippingAddress: formatAddress(d),
    lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
  };

  if (!saveOrder(order)) return { error: "Não foi possível registrar o pedido neste navegador (armazenamento bloqueado ou cheio)." };
  writeCartLines([]);
  // Navegação completa (equivale ao redirect() da Server Action): a página do pedido lê o id da URL.
  window.location.assign(withBasePath(`/pedido/?id=${encodeURIComponent(order.id)}`));
  // Mantém o botão em "Confirmando pedido…" até a página trocar.
  return new Promise<FormState>(() => {});
}
