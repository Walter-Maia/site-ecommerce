import NovidadesPage from "@/app/(loja)/novidades/page";

/**
 * Demo estática: envolve a página ORIGINAL (scripts/build-pages.mjs a move para
 * ./_page.tsx na cópia de build e reescreve este import). Sem searchParams no
 * servidor: a ListingPage entrega a lista completa e o cliente filtra pela URL.
 */
export { metadata } from "@/app/(loja)/novidades/page";

export default function Page() {
  return <NovidadesPage searchParams={Promise.resolve({})} />;
}
