import type { Metadata } from "next";
import { SITE } from "@/data/site";
import { ServerOnlyNotice } from "@/static/components/ServerOnlyNotice";

export const metadata: Metadata = {
  title: "Entrar",
  description: `O login de clientes existe na versão completa da ${SITE.name}, com servidor.`,
  robots: { index: false, follow: true },
};

/** Demo estática: /entrar sem servidor (login exige sessão em cookie e banco). */
export default function EntrarPage() {
  return (
    <ServerOnlyNotice
      kicker="Entrar"
      title="Login fica na versão com servidor."
      lead="Para entrar na conta é preciso um servidor que confira a senha e guarde a sessão com segurança. Esta demonstração no GitHub Pages é só estática, então o login está desligado aqui."
      features={[
        "Login com e-mail e senha (scrypt com sal por usuário)",
        "Sessão em cookie httpOnly com expiração e rotação",
        "Sacola, curtidas e looks levados para a conta ao entrar",
        "Limite de tentativas contra força bruta",
      ]}
    />
  );
}
