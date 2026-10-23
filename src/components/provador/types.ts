import type { GarmentProduct } from "@/lib/provador/contract";
import type {
  CategorySlug,
  GarmentSlot,
  LookBodySettings,
  MannequinPreset,
  ProductVariantStock,
  Size,
} from "@/lib/types";

/** Peça enviada ao cliente do provador: o que o motor precisa + vitrine mínima. */
export interface ProvadorProduct extends GarmentProduct {
  price: number;
  compareAtPrice?: number;
  category: CategorySlug;
  sizes: ProductVariantStock[];
  /** Packshot; null enquanto a foto não existir (mostra tile de cor). */
  image: string | null;
  imageAlt: string;
}

/** Look da aba LOOKS: pronto (curadoria) ou salvo pelo cliente. */
export interface GridLook {
  id: string;
  kind: "curated" | "saved";
  name: string;
  code: string;
  mannequinId: string;
  items: { productId: string; size?: Size }[];
  image: string | null;
  /** Só looks salvos: corpo e visual completos. */
  body?: LookBodySettings;
}

export interface ProvadorData {
  products: ProvadorProduct[];
  mannequins: MannequinPreset[];
  looks: GridLook[];
  wishlist: string[];
}

export type { GarmentSlot };
