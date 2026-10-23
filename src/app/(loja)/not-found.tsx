import Link from "next/link";

export default function LojaNotFound() {
  return (
    <main id="conteudo" className="gutter grid min-h-[60svh] content-center py-24">
      <p className="t-cond tabular text-sm font-semibold text-mute">Erro 404</p>
      <h1 className="t-display mt-3 max-w-3xl text-[clamp(3rem,8vw,6.5rem)]">Bola fora.</h1>
      <p className="mt-5 max-w-md text-ink-2">Essa página não existe ou a peça saiu da loja. Tente a busca ou volte para as novidades.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/novidades" className="btn btn-solid">
          Ver novidades
        </Link>
        <Link href="/busca" className="btn">
          Buscar peça
        </Link>
      </div>
    </main>
  );
}
