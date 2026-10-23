/** Rótulos e formatação compartilhados por /conta e /admin. */

export const ORDER_STATUS_LABEL = {
  "aguardando-pagamento": "Aguardando pagamento",
  pago: "Pago",
  enviado: "Enviado",
  cancelado: "Cancelado",
} as const;

export const PAYMENT_LABEL = { pix: "Pix", cartao: "Cartão de crédito" } as const;

export const HAIR_STYLE_LABEL = {
  raspado: "Raspado",
  curto: "Curto",
  "cacheado-curto": "Cacheado curto",
  "black-power": "Black power",
  trancas: "Tranças",
  "maria-chiquinha": "Maria-chiquinha",
  coque: "Coque",
  "rabo-de-cavalo": "Rabo de cavalo",
  "longo-liso": "Longo liso",
} as const;

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
