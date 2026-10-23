"use server";
import { redirect } from "next/navigation";
import type { FormState } from "./auth";
import { limiter, retryMessage } from "../auth/rate-limit";
import { getClientIp } from "../auth/request";
import { CheckoutError, placeOrder } from "../checkout";
import { getOwner } from "../session";
import { checkoutFromForm, checkoutSchema, fieldErrors } from "../validation";

/**
 * CONTRATO. Finaliza o pedido (pagamento SIMULADO). Em sucesso faz redirect
 * para /pedido/<id>. Campos do form: name, email, cpf (opcional), cep, street,
 * number, complement, district, city, state, paymentMethod ("pix" | "cartao").
 * Campos de cartão NÃO têm `name` no form e nunca são lidos aqui.
 */
export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const rl = limiter("checkoutIp").hit(ip);
  if (rl.limited) return { error: retryMessage(rl.retryAfterMs) };

  const parsed = checkoutSchema.safeParse(checkoutFromForm(formData));
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };

  const owner = await getOwner();
  if (!owner) return { error: "Seu carrinho está vazio." };

  let orderId: string;
  try {
    orderId = placeOrder(owner, parsed.data).id;
  } catch (err) {
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("[checkout]", err);
    return { error: "Não foi possível finalizar o pedido. Tente novamente." };
  }
  redirect(`/pedido/${orderId}`);
}
