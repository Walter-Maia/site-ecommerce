import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/conta/RegisterForm";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta KIM KRISS® para salvar looks do Provador 3D e acompanhar pedidos.",
  robots: { index: false, follow: false },
};

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/conta");

  return (
    <section className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
      <p className="t-label text-mute">Seja membro</p>
      <h1 className="t-title mt-3">Criar conta</h1>
      <p className="mt-4 text-ink-2">
        Seus looks do Provador 3D e o carrinho deste navegador vão junto para a conta quando você entrar.
      </p>
      <RegisterForm />
      <p className="mt-8 border-t border-line pt-6 text-sm text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </section>
  );
}
