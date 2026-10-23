import type { Metadata } from "next";
import { SITE } from "@/data/site";
import { LocalActivity } from "@/static/components/LocalActivity";
import { ServerOnlyNotice } from "@/static/components/ServerOnlyNotice";

export const metadata: Metadata = {
  title: "Minha conta",
  description: `A área do cliente existe na versão completa da ${SITE.name}, com servidor.`,
  robots: { index: false, follow: false },
};

/** Demo estática: /conta sem servidor, com o que este navegador já guardou. */
export default function ContaPage() {
  return (
    <ServerOnlyNotice
      kicker="Minha conta"
      title="Sua conta fica na versão com servidor."
      lead="Na versão completa, a conta reúne seus pedidos e looks salvos em qualquer aparelho. Aqui, sem servidor, eles ficam guardados só neste navegador."
      features={["Histórico de pedidos da conta", "Looks salvos no Provador 3D", "Sair da conta em qualquer aparelho", "Dados protegidos por sessão segura"]}
    >
      <LocalActivity />
    </ServerOnlyNotice>
  );
}
