import type { CuratedLook, MannequinPreset } from "@/lib/types";

/**
 * Os dois "bonecos moldes" iniciais. O admin cria quantos quiser
 * (corpo, pele, cabelo, estilo formal/informal) em /admin/manequins.
 */
export const MANNEQUIN_PRESETS: MannequinPreset[] = [
  {
    id: "m-mia",
    name: "MIA",
    body: "feminino",
    skinTone: "#B57A55",
    hairStyle: "maria-chiquinha",
    hairColor: "#1C1412",
    style: "informal",
    heightCm: 166,
    weightKg: 58,
    active: true,
    sortOrder: 1,
  },
  {
    id: "m-kaue",
    name: "KAUÃ",
    body: "masculino",
    skinTone: "#6B4430",
    hairStyle: "cacheado-curto",
    hairColor: "#141010",
    style: "informal",
    heightCm: 178,
    weightKg: 74,
    active: true,
    sortOrder: 2,
  },
];

/** Paletas sugeridas no provador e no admin (o admin também aceita hex livre). */
export const SKIN_TONES = [
  { name: "Porcelana", hex: "#F3D5C0" },
  { name: "Clara", hex: "#E8B898" },
  { name: "Média clara", hex: "#D09A72" },
  { name: "Média", hex: "#B57A55" },
  { name: "Morena", hex: "#8D5A3B" },
  { name: "Retinta", hex: "#6B4430" },
  { name: "Profunda", hex: "#3F271C" },
] as const;

export const HAIR_COLORS = [
  { name: "Preto", hex: "#141010" },
  { name: "Castanho escuro", hex: "#3B2416" },
  { name: "Castanho", hex: "#6A4128" },
  { name: "Ruivo", hex: "#A4482A" },
  { name: "Loiro", hex: "#D8B66A" },
  { name: "Platinado", hex: "#E9E4D6" },
  { name: "Rosa", hex: "#F27BAA" },
  { name: "Azul", hex: "#4FB6E8" },
] as const;

/**
 * Looks prontos da grade "character select". Os bloqueados aparecem como "OFF ?"
 * (próximos drops). Miniaturas em /images/provador/looks/<id>.webp.
 */
export const CURATED_LOOKS: CuratedLook[] = [
  { id: "look-arquibancada", name: "Arquibancada", code: "STREET · 01", mannequinId: "m-kaue", productSlugs: ["camiseta-oversized-kim-kriss-07-preta", "bermuda-mesh-kim-kriss-preta", "bone-dad-hat-kim-kriss-preto", "tenis-court-low-branco"] },
  { id: "look-y2k", name: "Y2K Drop", code: "Y2K · 02", mannequinId: "m-mia", productSlugs: ["baby-tee-kim-kriss-rosa-chiclete", "saia-jeans-cintura-baixa-azul", "tenis-court-low-branco"] },
  { id: "look-social-club", name: "Social Club", code: "FORMAL · 03", mannequinId: "m-kaue", productSlugs: ["camisa-oxford-branca", "blazer-alfaiataria-oversized-preto", "calca-alfaiataria-pregas-grafite", "mocassim-couro-preto"] },
  { id: "look-noite", name: "Noite de cetim", code: "FORMAL · 04", mannequinId: "m-mia", productSlugs: ["vestido-slip-cetim-preto", "blazer-alfaiataria-oversized-preto", "mocassim-couro-preto"] },
  { id: "look-pinstripe", name: "Pinstripe", code: "STREET · 05", mannequinId: "m-kaue", productSlugs: ["camisa-baseball-pinstripe-preta", "calca-jeans-baggy-azul-lavado", "tenis-court-low-branco"] },
  { id: "look-inverno", name: "Inverno 26", code: "COZY · 06", mannequinId: "m-mia", productSlugs: ["moletom-cropped-cinza-mescla", "calca-moletom-wide-cinza-mescla", "bone-five-panel-vermelho", "tenis-court-low-branco"] },
  { id: "look-quadra", name: "Dia de quadra", code: "SPORT · 07", mannequinId: "m-kaue", productSlugs: ["camisa-basquete-mesh-23-vermelha", "bermuda-mesh-kim-kriss-preta", "tenis-court-low-branco"] },
  { id: "look-varsity", name: "Varsity", code: "STREET · 08", mannequinId: "m-mia", productSlugs: ["top-regata-canelada-preta", "jaqueta-varsity-bordo-creme", "calca-wide-leg-alfaiataria-off-white", "tenis-court-low-branco"] },
  { id: "look-cetim", name: "Cetim & moletom", code: "MIX · 09", mannequinId: "m-mia", productSlugs: ["moletom-careca-arquibancada-creme", "saia-midi-cetim-champagne", "mocassim-couro-preto"] },
  { id: "look-corta-vento", name: "Corta-vento", code: "SPORT · 10", mannequinId: "m-kaue", productSlugs: ["regata-machao-kim-kriss-16-cinza-mescla", "corta-vento-nylon-azul-marinho", "calca-moletom-wide-cinza-mescla", "bone-five-panel-vermelho", "tenis-court-low-branco"] },
  { id: "look-jersey-dress", name: "Jersey dress", code: "STREET · 11", mannequinId: "m-mia", productSlugs: ["vestido-jersey-oversized-07-preto", "bone-dad-hat-kim-kriss-preto", "tenis-court-low-branco"] },
  { id: "look-role", name: "Rolê", code: "SKATE · 12", mannequinId: "m-kaue", productSlugs: ["gorro-beanie-kim-kriss-preto", "camiseta-skate-boxy-kim-kriss-skate-co-off-white", "jaqueta-workwear-lona-caramelo", "calca-cargo-skate-oliva", "tenis-skate-vulcanizado-preto", "skate-completo-kim-kriss-8-25"] },
  { id: "look-pista", name: "Pista", code: "SKATE · 13", mannequinId: "m-mia", productSlugs: ["camiseta-manga-longa-kk-preta", "bermuda-cargo-preta", "tenis-skate-camurca-bege-sola-goma", "skate-completo-kim-kriss-8-25"] },
  { id: "look-flanela", name: "Flanela", code: "SKATE · 14", mannequinId: "m-kaue", productSlugs: ["camiseta-skate-boxy-kim-kriss-skate-co-off-white", "camisa-flanela-xadrez-vermelha", "calca-carpinteiro-jeans-preta", "tenis-skate-camurca-bege-sola-goma", "bone-five-panel-vermelho"] },
  { id: "look-off-3", name: "Próximo drop", code: "OFF ?", mannequinId: "m-mia", productSlugs: [], locked: true },
];
