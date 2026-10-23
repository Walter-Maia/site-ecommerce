/**
 * Tipos de domínio compartilhados por loja, provador 3D, servidor e admin.
 * Contrato estável: mudanças aqui afetam todos os módulos (ver docs/ARQUITETURA.md).
 */

export type Gender = "feminino" | "masculino" | "unissex";

export type CategorySlug =
  | "camisetas"
  | "regatas-e-tops"
  | "jerseys"
  | "camisas"
  | "moletons"
  | "jaquetas"
  | "alfaiataria"
  | "bermudas"
  | "calcas"
  | "saias"
  | "vestidos"
  | "bones"
  | "calcados"
  | "skate";

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Frase curta usada em listagens, meta description e respostas (AEO). */
  description: string;
}

/**
 * Onde a peça é vestida no manequim. `full` ocupa torso + pernas (vestidos).
 * `prop` = objeto segurado/ao lado do manequim (skate), sem caimento.
 */
export type GarmentSlot = "head" | "top" | "outer" | "bottom" | "full" | "feet" | "prop";

export type GarmentKind =
  | "tee" // camiseta
  | "babyTee" // camiseta baby look / cropped justa
  | "tank" // regata
  | "ribTank" // top/regata canelada justa
  | "jersey" // camisa de baseball/basquete
  | "shirt" // camisa social/oxford
  | "hoodie" // moletom canguru com capuz
  | "croppedHoodie"
  | "crewneck" // moletom careca
  | "varsityJacket"
  | "windbreaker"
  | "blazer"
  | "shorts" // bermuda de moletom
  | "meshShorts" // bermuda mesh de basquete
  | "sweatpants"
  | "jeans"
  | "trousers" // calça de alfaiataria reta
  | "wideTrousers"
  | "miniSkirt"
  | "midiSkirt"
  | "dress" // vestido jersey oversized
  | "slipDress"
  | "cap"
  | "sneaker"
  | "loafer"
  // linha skate / streetwear
  | "longTee" // camiseta manga longa
  | "zipHoodie" // moletom com zíper e capuz
  | "workJacket" // jaqueta workwear (chore coat) de lona, gola de veludo cotelê
  | "cargoPants" // calça cargo larga com bolsos laterais
  | "cargoShorts" // bermuda cargo
  | "beanie" // gorro
  | "skateShoe" // tênis de skate vulcanizado, mais robusto
  | "skateboard"; // skate completo (slot "prop")

export type Silhouette = "slim" | "regular" | "oversized" | "wide" | "cropped";

export type FabricPattern =
  | "solid"
  | "pinstripe"
  | "mesh"
  | "denim"
  | "rib"
  | "satin"
  | "leather"
  | "heather"
  | "nylon"
  | "plaid" // xadrez (flanela): base + secondary + trim
  | "canvas" // lona/sarja pesada
  | "corduroy"; // veludo cotelê

export type Formality = "formal" | "casual" | "esportivo";

/**
 * Especificação que o provador 3D usa para gerar a peça proceduralmente.
 * As fotos (packshot/modelo) e a peça 3D devem contar a mesma história:
 * mesma cor, mesmo grafismo, mesmo texto.
 */
export interface GarmentSpec {
  kind: GarmentKind;
  slot: GarmentSlot;
  silhouette: Silhouette;
  colors: {
    base: string; // hex
    secondary?: string; // mangas, painéis, listras
    trim?: string; // gola, punhos, barra, cadarço
  };
  pattern: FabricPattern;
  graphic?: {
    text: string;
    style: "varsity" | "script" | "gothic" | "block";
    color: string;
    outline?: string;
    number?: string;
    placement: "chest" | "center" | "back" | "leftChest" | "leg" | "front";
  };
  formality: Formality;
}

export type ApparelSize = "PP" | "P" | "M" | "G" | "GG" | "XGG";
export type ShoeSize = "37" | "38" | "39" | "40" | "41" | "42" | "43" | "44";
export type Size = ApparelSize | ShoeSize | "U";

/**
 * Medidas da PEÇA (não do corpo), em centímetros.
 * Circunferências completas (busto/cintura/quadril), não meia-largura.
 */
export interface SizeChartRow {
  size: Size;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  lengthCm?: number; // comprimento total da peça
  sleeveCm?: number;
  inseamCm?: number; // entrepernas
  footCm?: number; // comprimento interno do calçado
  headCm?: number; // circunferência de cabeça (bonés)
}

export interface ProductImage {
  src: string; // caminho em /public, ex.: /images/produtos/<slug>/packshot.webp
  alt: string;
  kind: "packshot" | "modelo" | "detalhe";
  width: number;
  height: number;
}

export interface ProductVariantStock {
  size: Size;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Nome curto para HUD/cards compactos do provador. */
  shortName: string;
  description: string;
  /** Bullets de características (modelagem, tecido, acabamento, estampa). */
  details: string[];
  category: CategorySlug;
  gender: Gender;
  collection: string;
  /** Preço em centavos (BRL). */
  price: number;
  compareAtPrice?: number;
  colorName: string;
  colorHex: string;
  sizes: ProductVariantStock[];
  sizeChart: SizeChartRow[];
  images: ProductImage[];
  garment: GarmentSpec;
  tags: string[];
  rating: number; // 0–5
  reviewCount: number;
  isNew: boolean;
  isFeatured: boolean;
  /** ISO date */
  createdAt: string;
}

export type ProductSort = "relevancia" | "novidades" | "menor-preco" | "maior-preco";

export interface ProductQuery {
  category?: CategorySlug;
  gender?: Gender;
  q?: string;
  ids?: string[];
  formality?: Formality;
  slot?: GarmentSlot;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

/* ───────────────────────── Manequins ───────────────────────── */

export type MannequinBody = "feminino" | "masculino";

export type HairStyle =
  | "raspado" // buzz cut
  | "curto"
  | "cacheado-curto"
  | "black-power"
  | "trancas" // tranças longas / box braids
  | "maria-chiquinha" // pigtails trançadas (MIA do prompt)
  | "coque"
  | "rabo-de-cavalo"
  | "longo-liso";

/** formal = postura ereta, acabamento de vitrine; informal = pose relaxada, vibe streetwear/Y2K. */
export type MannequinStyle = "formal" | "informal";

export interface MannequinPreset {
  id: string;
  name: string; // exibido na placa "MIA · LOOK Nº 03"
  body: MannequinBody;
  skinTone: string; // hex
  hairStyle: HairStyle;
  hairColor: string; // hex
  style: MannequinStyle;
  /** Medidas padrão ao abrir o provador; o cliente ajusta depois. */
  heightCm: number;
  weightKg: number;
  active: boolean;
  sortOrder: number;
}

/** Limites aceitos pelo provador e validados no servidor. */
export const BODY_LIMITS = {
  heightCm: { min: 145, max: 205 },
  weightKg: { min: 40, max: 150 },
} as const;

/* ───────────────────────── Looks ───────────────────────── */

export interface LookItem {
  productId: string;
  size: Size;
}

export interface LookBodySettings {
  mannequinId: string;
  heightCm: number;
  weightKg: number;
  skinTone: string;
  hairColor: string;
  hairStyle: HairStyle;
  style: MannequinStyle;
}

/** Look salvo pelo cliente no provador. */
export interface SavedLook {
  id: string;
  name: string;
  body: LookBodySettings;
  items: LookItem[];
  createdAt: string;
}

/** Look editorial pronto (grade "character select" do provador). */
export interface CuratedLook {
  id: string;
  name: string;
  /** Rótulo curto estilo game: "STREET · 01" */
  code: string;
  mannequinId: string;
  productSlugs: string[];
  /** Miniatura; se ausente, o provador renderiza a partir do 3D. */
  thumbnail?: string;
  /** Slot travado "OFF ?" (drop futuro). */
  locked?: boolean;
}

/* ───────────────────────── Carrinho / pedidos ───────────────────────── */

export interface CartLine {
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  size: Size;
  quantity: number;
  unitPrice: number; // centavos, sempre calculado no servidor
  lineTotal: number;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  /** Frete grátis acima de FREE_SHIPPING_THRESHOLD. */
  shipping: number;
  total: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "cliente" | "admin";
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
