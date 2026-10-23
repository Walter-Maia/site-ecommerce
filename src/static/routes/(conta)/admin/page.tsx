import type { Metadata } from "next";
import { SITE } from "@/data/site";
import { ServerOnlyNotice } from "@/static/components/ServerOnlyNotice";

export const metadata: Metadata = {
  title: "Painel administrativo",
  description: `O painel administrativo existe na versão completa da ${SITE.name}, com servidor.`,
  robots: { index: false, follow: false },
};

/** Demo estática: /admin sem servidor (o painel exige login de administrador e banco). */
export default function AdminPage() {
  return (
    <ServerOnlyNotice
      kicker="Admin"
      title="O painel fica na versão com servidor."
      lead="O painel da loja edita catálogo, estoque, manequins e pedidos num banco SQLite, com acesso só para administradores. Nada disso cabe num site estático, então ele não foi publicado aqui."
      features={[
        "Produtos: preço, estoque por tamanho e destaque",
        "Manequins do provador com pré-visualização 3D ao vivo",
        "Pedidos e mudança de status",
        "Tudo auditado e com autorização checada em cada ação",
      ]}
    />
  );
}
