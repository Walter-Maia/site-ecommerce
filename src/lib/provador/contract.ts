/**
 * Contrato entre o MOTOR 3D/caimento (src/lib/provador/**, src/components/provador/scene/**)
 * e a INTERFACE do provador (demais arquivos de src/components/provador/** e a rota /provador).
 * Assinaturas estáveis; o motor implementa, a interface consome.
 */
import type {
  HairStyle,
  MannequinBody,
  MannequinStyle,
  Product,
  Size,
} from "@/lib/types";

export interface BodyParams {
  body: MannequinBody;
  heightCm: number;
  weightKg: number;
}

export interface Appearance {
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  style: MannequinStyle;
}

/** Medidas do CORPO estimadas a partir de altura/peso/corpo (cm). */
export interface BodyMeasurements {
  heightCm: number;
  weightKg: number;
  bmi: number;
  chestCm: number; // busto/tórax (circunferência)
  waistCm: number;
  hipCm: number;
  shoulderCm: number; // largura ombro a ombro
  torsoLengthCm: number; // base do pescoço → cintura
  inseamCm: number; // entrepernas
  armLengthCm: number;
  headCm: number;
  footCm: number;
}

export type FitLabel = "apertado" | "justo" | "ideal" | "solto" | "grande";

export interface FitResult {
  size: Size;
  label: FitLabel;
  /** 0–100: quão bem esse tamanho veste esse corpo para a modelagem proposta. */
  score: number;
  /** Folga = medida da peça − medida do corpo (cm). Negativo = aperta. */
  easeCm: { chest?: number; waist?: number; hip?: number; head?: number; foot?: number };
  /** Diferença de comprimento em relação ao ideal (cm). + = mais longo. */
  lengthDeltaCm?: number;
  /** Frases curtas em pt-BR para a UI, ex.: "Barra 3 cm abaixo do quadril". */
  notes: string[];
}

/** Subconjunto do produto que o motor precisa (serializável para o cliente). */
export type GarmentProduct = Pick<
  Product,
  "id" | "slug" | "name" | "shortName" | "garment" | "sizeChart" | "colorName" | "colorHex"
>;

export interface WornItem {
  product: GarmentProduct;
  size: Size;
  fit: FitResult;
}

export type SceneTheme = "y2k" | "boutique" | "neutral";
export type SceneView = "frente" | "costas" | "livre";

export interface MannequinSceneProps {
  bodyParams: BodyParams;
  appearance: Appearance;
  outfit: WornItem[];
  autoRotate: boolean;
  view: SceneView;
  /** Incrementar para disparar um giro de 360° animado. */
  spinSignal?: number;
  /** "y2k" no provador; "boutique" quando o manequim é formal; "neutral" no admin. */
  theme?: SceneTheme;
  quality?: "alta" | "baixa";
  /** Descrição textual do look para leitores de tela. */
  ariaLabel: string;
  className?: string;
  onReady?: () => void;
}
