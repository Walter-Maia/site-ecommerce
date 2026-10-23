import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Table, td, th } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { listProductsForAdmin } from "@/server/admin/products";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Produtos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminProdutos({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const products = listProductsForAdmin(q || undefined);

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Produtos">
        <p className="mt-2 text-sm text-mute">{products.length} peças. Edite preço, promoção, estoque e vitrine.</p>
      </PageHeader>

      <form role="search" className="mb-6 flex max-w-md gap-2" action="/admin/produtos">
        <label htmlFor="busca-produto" className="sr-only">
          Buscar produto
        </label>
        <input
          id="busca-produto"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou slug"
          className="min-h-12 w-full border border-line bg-paper px-3 outline-none focus:border-ink"
        />
        <button type="submit" className="btn">
          Buscar
        </button>
      </form>

      <Table caption="Lista de produtos">
        <thead>
          <tr>
            <th scope="col" className={th}>Produto</th>
            <th scope="col" className={`${th} text-right`}>Preço</th>
            <th scope="col" className={`${th} text-right`}>De</th>
            <th scope="col" className={`${th} text-right`}>Estoque</th>
            <th scope="col" className={`${th} text-right`}>Curtidas</th>
            <th scope="col" className={th}>Vitrine</th>
            <th scope="col" className={th}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className={td}>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-mute">
                  {p.id} · {p.category}
                </p>
              </td>
              <td className={`${td} tabular text-right`}>{formatPrice(p.price)}</td>
              <td className={`${td} tabular text-right text-mute`}>{p.compareAtPrice ? formatPrice(p.compareAtPrice) : "—"}</td>
              <td className={`${td} tabular text-right`}>
                {p.totalStock}
                {p.lowSizes > 0 ? (
                  <span className="ml-2 text-xs text-signal" title="Tamanhos com 3 peças ou menos">
                    {p.lowSizes} baixo{p.lowSizes > 1 ? "s" : ""}
                  </span>
                ) : null}
              </td>
              <td className={`${td} tabular text-right`}>{p.likes}</td>
              <td className={td}>
                <span className="flex gap-1.5">
                  {p.isFeatured ? <span className="t-label border border-ink px-1.5 py-0.5">Destaque</span> : null}
                  {p.isNew ? <span className="t-label border border-line px-1.5 py-0.5">Novo</span> : null}
                </span>
              </td>
              <td className={`${td} text-right`}>
                <Link href={`/admin/produtos/${p.id}`} className="t-label link-line" aria-label={`Editar ${p.name}`}>
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
