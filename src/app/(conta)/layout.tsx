import Link from "next/link";
import { Logo } from "@/components/loja/Logo";

/** Layout enxuto das páginas de conta (a loja tem header/footer próprios em (loja)). */
export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-paper text-ink">
      <a href="#conteudo" className="sr-only-focusable fixed left-3 top-3 z-50 bg-ink px-4 py-3 text-sm text-paper">
        Pular para o conteúdo
      </a>
      <header className="border-b border-line">
        <div className="gutter mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 text-xl font-extrabold italic tracking-tight" aria-label="KIM & KRIS, voltar para a página inicial">
            <Logo title="" className="size-11" />
            KIM & KRIS
          </Link>
          <Link href="/" className="t-label link-line relative text-ink-2 after:absolute after:inset-x-0 after:-inset-y-[15px] after:content-['']">
            ← Voltar para a loja
          </Link>
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line">
        <p className="gutter mx-auto max-w-6xl py-6 text-xs text-mute">
          KIM & KRIS — loja de demonstração. Nenhum pagamento é cobrado.
        </p>
      </footer>
    </div>
  );
}
