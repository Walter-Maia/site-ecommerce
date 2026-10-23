import { buildLlmsFullTxt, textResponse } from "@/lib/seo/llms";

/** /llms-full.txt — catálogo completo (detalhes, estoque por tamanho e medidas) + todas as perguntas. */
export const dynamic = "force-dynamic";

export async function GET() {
  return textResponse(await buildLlmsFullTxt());
}
