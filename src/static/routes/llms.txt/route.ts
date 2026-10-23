/** Demo estática: o /llms.txt original gerado uma vez no build (vira o arquivo llms.txt). */
export { GET } from "@/app/llms.txt/route";

export const dynamic = "force-static";
