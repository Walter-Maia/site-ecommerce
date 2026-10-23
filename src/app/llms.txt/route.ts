import { buildLlmsTxt, textResponse } from "@/lib/seo/llms";

/** /llms.txt — resumo para LLMs e mecanismos de resposta (ver src/lib/seo/llms.ts). */
export const dynamic = "force-dynamic";

export async function GET() {
  return textResponse(await buildLlmsTxt());
}
