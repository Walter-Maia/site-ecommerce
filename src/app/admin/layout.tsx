import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { logoutAction } from "@/server/actions/auth";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Admin KIM KRISS®" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * O layout também checa, mas layouts não re-renderizam em toda navegação:
 * cada página e cada ação do admin chama requireAdmin() de novo.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-svh bg-paper text-ink lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a href="#conteudo" className="sr-only-focusable fixed left-3 top-3 z-50 bg-ink px-4 py-3 text-sm text-paper">
        Pular para o conteúdo
      </a>
      <aside className="border-b border-line bg-paper lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between gap-3 px-6">
          <Link href="/admin" className="text-lg font-extrabold italic tracking-tight">
            KIM KRISS® <span className="t-label ml-1 not-italic text-mute">admin</span>
          </Link>
          <Link href="/" className="t-label text-mute hover:text-ink lg:hidden">
            Loja
          </Link>
        </div>
        <AdminNav />
        <div className="mt-auto hidden space-y-3 border-t border-line px-6 py-5 text-sm lg:block">
          <p className="truncate text-mute" title={admin.email}>
            {admin.email}
          </p>
          <div className="flex items-center justify-between">
            <Link href="/" className="t-label link-line">
              Ver loja
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="t-label link-line">
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        {children}
      </main>
    </div>
  );
}
