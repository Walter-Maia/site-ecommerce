import ProvadorPage from "@/app/(loja)/provador/page";

/**
 * Demo estática: a página original do provador, sem searchParams no servidor.
 * ?look= e ?add= (e curtidas/looks salvos) são lidos no cliente pelo FittingRoom.
 */
export { generateMetadata } from "@/app/(loja)/provador/page";

export default function Page() {
  return <ProvadorPage searchParams={Promise.resolve({})} />;
}
