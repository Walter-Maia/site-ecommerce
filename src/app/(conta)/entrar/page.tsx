import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormAlert } from "@/components/conta/Field";
import { LoginForm } from "@/components/conta/LoginForm";
import { getCurrentUser, safeNextPath } from "@/server/session";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta KIM & KRIS para ver pedidos e looks salvos.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EntrarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);
  const user = await getCurrentUser();
  if (user) redirect(next ?? (user.role === "admin" ? "/admin" : "/conta"));

  return (
    <section className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
      <p className="t-label text-mute">Sua conta</p>
      <h1 className="t-title mt-3">Entrar</h1>
      <p className="mt-4 text-ink-2">Acompanhe pedidos e abra seus looks salvos no Provador 3D.</p>
      {sp.cadastro === "ok" ? (
        <div className="mt-6">
          <FormAlert tone="ok">Cadastro recebido. Entre com seu e-mail e a senha que você criou.</FormAlert>
        </div>
      ) : null}
      <LoginForm next={next ?? ""} />
      <p className="mt-8 border-t border-line pt-6 text-sm text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-ink underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </section>
  );
}
