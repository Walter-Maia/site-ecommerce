import "server-only";
import type {
  GarmentSpec,
  MannequinPreset,
  Product,
  ProductImage,
  ProductVariantStock,
  Size,
  SizeChartRow,
} from "@/lib/types";
import { parseJson } from "../util";

export interface ProductRow {
  id: string;
  slug: string;
  position: number;
  name: string;
  short_name: string;
  description: string;
  details: string;
  category: Product["category"];
  gender: Product["gender"];
  collection: string;
  price: number;
  compare_at_price: number | null;
  color_name: string;
  color_hex: string;
  size_chart: string;
  images: string;
  garment: string;
  tags: string;
  rating: number;
  review_count: number;
  is_new: number;
  is_featured: number;
  created_at: string;
}

export interface SizeRow {
  product_id: string;
  size: Size;
  stock: number;
}

export function toProduct(r: ProductRow, sizes: ProductVariantStock[]): Product {
  const p: Product = {
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortName: r.short_name,
    description: r.description,
    details: parseJson<string[]>(r.details, []),
    category: r.category,
    gender: r.gender,
    collection: r.collection,
    price: r.price,
    colorName: r.color_name,
    colorHex: r.color_hex,
    sizes,
    sizeChart: parseJson<SizeChartRow[]>(r.size_chart, []),
    images: parseJson<ProductImage[]>(r.images, []),
    garment: parseJson<GarmentSpec>(r.garment, {} as GarmentSpec),
    tags: parseJson<string[]>(r.tags, []),
    rating: r.rating,
    reviewCount: r.review_count,
    isNew: r.is_new === 1,
    isFeatured: r.is_featured === 1,
    createdAt: r.created_at.slice(0, 10),
  };
  if (r.compare_at_price != null) p.compareAtPrice = r.compare_at_price;
  return p;
}

export interface MannequinRow {
  id: string;
  name: string;
  body: MannequinPreset["body"];
  skin_tone: string;
  hair_style: MannequinPreset["hairStyle"];
  hair_color: string;
  style: MannequinPreset["style"];
  height_cm: number;
  weight_kg: number;
  active: number;
  sort_order: number;
}

export function toMannequin(r: MannequinRow): MannequinPreset {
  return {
    id: r.id,
    name: r.name,
    body: r.body,
    skinTone: r.skin_tone,
    hairStyle: r.hair_style,
    hairColor: r.hair_color,
    style: r.style,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    active: r.active === 1,
    sortOrder: r.sort_order,
  };
}
