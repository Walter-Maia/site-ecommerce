import Link from "next/link";
import { REPO_URL } from "@/lib/static-demo";

/**
 * Página informativa da demo estática para rotas que exigem servidor
 * (/entrar, /cadastro, /conta, /admin). Fica dentro do layout de (conta).
 */
export function ServerOnlyNotice({
  kicker,
  title,
  lead,
  features,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  /** O que a rota faz na versão completa. */
  features: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="gutter mx-auto max-w-6xl pb-24 pt-14 md:pt-20">
      <p className="t-label text-mute">{kicker}</p>
      <h1 className="t-display mt-4 max-w-4xl text-[clamp(2.6rem,7vw,5.5rem)]">{title}</h1>
      <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ink-2">{lead}</p>

      <div className="mt-12 grid gap-10 border-t border-line pt-10 md:grid-cols-12">
        <div className="md:col-span-6">
          <h2 className="t-label text-mute">Na versão completa, com servidor</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {features.map((f) => (
              <li key={f} className="py-3 text-[0.98rem]">
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-5 md:col-start-8">
          <div className="bg-sand p-6 md:p-8">
            <h2 className="font-serif text-2xl tracking-[-0.02em]">Esta é a demonstração estática</h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
              Publicada no GitHub Pages, sem servidor: não há banco, sessão nem cookies. A loja, os filtros, a sacola, o checkout simulado e o
              Provador 3D funcionam, e o que você faz fica salvo só neste navegador.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/" className="btn btn-solid">
                Ir para a loja
              </Link>
              <a href={REPO_URL} className="btn" rel="noopener">
                Código no GitHub
              </a>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
