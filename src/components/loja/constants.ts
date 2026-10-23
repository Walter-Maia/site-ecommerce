/** Constantes de UI da loja (módulo neutro: pode ser importado por server e client). */

export const POPULAR_SEARCHES = ["oversized", "jersey", "moletom", "alfaiataria", "y2k", "cetim", "boné"];

export const COLLECTIONS = [
  { slug: "arquibancada", name: "Arquibancada" },
  { slug: "social-club", name: "Social Club" },
  { slug: "y2k-drop", name: "Y2K Drop" },
  { slug: "inverno-26", name: "Inverno 26" },
  { slug: "role", name: "Rolê" },
] as const;

export const PRICE_RANGES = [
  { value: "ate-150", label: "Até R$ 150", min: 0, max: 15000 },
  { value: "150-250", label: "R$ 150 a R$ 250", min: 15000, max: 25000 },
  { value: "250-400", label: "R$ 250 a R$ 400", min: 25000, max: 40000 },
  { value: "acima-400", label: "Acima de R$ 400", min: 40000, max: Infinity },
] as const;

export const SORTS = [
  { value: "relevancia", label: "Relevância" },
  { value: "novidades", label: "Novidades" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
] as const;

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "37", "38", "39", "40", "41", "42", "43", "44", "U"] as const;

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
