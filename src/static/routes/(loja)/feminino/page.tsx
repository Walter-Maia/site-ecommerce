import FemininoPage from "@/app/(loja)/feminino/page";

/** Demo estática: página original sem searchParams no servidor (ver novidades/page.tsx). */
export { metadata } from "@/app/(loja)/feminino/page";

export default function Page() {
  return <FemininoPage searchParams={Promise.resolve({})} />;
}
