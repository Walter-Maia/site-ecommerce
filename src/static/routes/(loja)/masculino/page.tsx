import MasculinoPage from "@/app/(loja)/masculino/page";

/** Demo estática: página original sem searchParams no servidor (ver novidades/page.tsx). */
export { metadata } from "@/app/(loja)/masculino/page";

export default function Page() {
  return <MasculinoPage searchParams={Promise.resolve({})} />;
}
