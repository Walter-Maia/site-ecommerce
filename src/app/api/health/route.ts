import { get } from "@/server/db/client";

/** Healthcheck para orquestrador/monitoramento. Não expõe versões nem contagens. */
export async function GET() {
  try {
    get("SELECT 1");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
