import type { Metadata } from "next";
import { SITE } from "@/data/site";
import { ServerOnlyNotice } from "@/static/components/ServerOnlyNotice";

export const metadata: Metadata = {
  title: "Criar conta",
  description: `O cadastro de clientes existe na versão completa da ${SITE.name}, com servidor.`,
  robots: { index: false, follow: true },
};

/** Demo estática: /cadastro sem servidor. */
export default function CadastroPage() {
  return (
    <ServerOnlyNotice
      kicker="Criar conta"
      title="Cadastro fica na versão com servidor."
      lead="Criar uma conta exige guardar seus dados num banco, com senha protegida. Nesta demonstração estática não há banco: você pode comprar como convidado, com pagamento simulado."
      features={[
        "Cadastro com validação e senha forte",
        "Pedidos e looks salvos na conta, em qualquer aparelho",
        "Resposta igual para e-mail novo ou já cadastrado (sem enumeração)",
        "Limite de tentativas por IP",
      ]}
    />
  );
}
