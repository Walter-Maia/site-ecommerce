import type { Metadata } from "next";
import { CartSync } from "@/components/loja/CartSync";
import { getCart } from "@/server/cart";
import { Breadcrumbs } from "@/components/loja/Breadcrumbs";
import { CartPageView } from "@/components/loja/CartPageView";

export const metadata: Metadata = {
  title: "Sacola",
  description: "Revise as peças da sua sacola, ajuste quantidades e finalize a compra na KIM & KRIS.",
  alternates: { canonical: "/carrinho" },
  robots: { index: false, follow: false },
};

export default async function CarrinhoPage() {
  // Sacola fresca do servidor (ex.: peças adicionadas pelo provador).
  const cart = await getCart();
  return (
    <main id="conteudo" className="gutter pb-24 pt-5">
      <CartSync cart={cart} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Sacola", path: "/carrinho" },
        ]}
      />
      <h1 className="t-display mb-10 mt-6 text-[clamp(3rem,8vw,6.5rem)]">Sacola</h1>
      <CartPageView />
    </main>
  );
}
