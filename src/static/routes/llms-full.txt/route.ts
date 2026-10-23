/** Demo estática: o /llms-full.txt original gerado uma vez no build. */
export { GET } from "@/app/llms-full.txt/route";

export const dynamic = "force-static";
