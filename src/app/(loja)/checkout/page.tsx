import type { Metadata } from "next";
import { CartSync } from "@/components/loja/CartSync";
import { getCart } from "@/server/cart";
import { CheckoutForm } from "@/components/loja/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Informe contato, endereço de entrega e forma de pagamento para concluir o pedido. Pagamento simulado.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Sacola fresca do servidor (ex.: peças adicionadas pelo provador).
  const cart = await getCart();
  return (
    <main id="conteudo" className="gutter pb-24 pt-8">
      <CartSync cart={cart} />
      <h1 className="t-display mb-10 text-[clamp(2.6rem,6vw,5rem)]">Finalizar compra</h1>
      <CheckoutForm />
    </main>
  );
}
