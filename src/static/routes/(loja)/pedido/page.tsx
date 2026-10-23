import type { Metadata } from "next";
import { SITE } from "@/data/site";
import { Suspense } from "react";
import { StaticOrder } from "@/static/components/StaticOrder";

/**
 * Demo estática: substitui /pedido/[id] (gerado por requisição no servidor).
 * O checkout simulado grava o pedido no localStorage e navega para /pedido/?id=<id>.
 */
export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: `Resumo do seu pedido na ${SITE.name}.`,
  robots: { index: false, follow: false },
};

export default function PedidoPage() {
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="gutter min-h-[60svh] pb-24 pt-10">
          <p className="text-sm text-mute">Carregando o pedido…</p>
        </main>
      }
    >
      <StaticOrder />
    </Suspense>
  );
}
