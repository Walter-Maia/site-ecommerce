import "server-only";
import { PROVADOR_FAQ, PROVADOR_STEPS } from "@/app/(loja)/provador/faq";
import { COLLECTIONS } from "@/components/loja/constants";
import {
  CASHBACK_PERCENT,
  CATEGORIES,
  FAQ,
  FLAT_SHIPPING,
  FREE_SHIPPING_THRESHOLD,
  MAX_INSTALLMENTS,
  SITE,
} from "@/data/site";
import { formatPrice } from "@/lib/format";
import { BODY_LIMITS, type Product, type SizeChartRow } from "@/lib/types";
import { listProducts } from "@/server/catalog";
import { listMannequins } from "@/server/mannequins";
import { absoluteUrl } from "./jsonld";

/**
 * llms.txt (https://llmstxt.org): resumo em Markdown para mecanismos de
 * resposta e LLMs. Gerado do catálogo (SQLite) e dos mesmos textos da
 * página /ajuda e do /provador, para nunca divergir do que o site mostra.
 */

// Intl usa espaço não separável em "R$ 189,90"; em texto puro, espaço comum.
const price = (cents: number) => formatPrice(cents).replace(/ /g, " ");
const GENDER: Record<Product["gender"], string> = { feminino: "feminino", masculino: "masculino", unissex: "unissex" };
const categoryName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function sizesLine(p: Product) {
  const inStock = p.sizes.filter((s) => s.stock > 0).map((s) => s.size);
  const out = p.sizes.filter((s) => s.stock <= 0).map((s) => s.size);
  if (!inStock.length) return "esgotado";
  return `tamanhos ${inStock.join(", ")}${out.length ? ` (esgotado: ${out.join(", ")})` : ""}`;
}

function priceLine(p: Product) {
  const was = p.compareAtPrice && p.compareAtPrice > p.price ? ` (de ${price(p.compareAtPrice)})` : "";
  return `${price(p.price)}${was}`;
}

function header(generatedAt: string) {
  return [
    `# ${SITE.name}®`,
    "",
    `> ${SITE.description}`,
    "",
    `- Loja de demonstração: ${SITE.name}® é uma marca fictícia de streetwear esportivo de ${SITE.city}. Os produtos, avaliações e pedidos são de exemplo e o pagamento é simulado (nenhum valor é cobrado).`,
    `- Idioma: português do Brasil. Moeda: real (BRL). Preços e estoque gerados a partir do catálogo em ${generatedAt}.`,
    `- Site: ${absoluteUrl("/")} · Contato: ${SITE.email}`,
    "",
  ];
}

function policies() {
  return [
    "## Políticas da loja",
    "",
    `- Frete: grátis acima de ${price(FREE_SHIPPING_THRESHOLD)}; abaixo disso, taxa fixa de ${price(FLAT_SHIPPING)} para todo o Brasil, com rastreio por e-mail.`,
    `- Trocas e devoluções: até 30 dias após o recebimento, peça sem uso e com etiqueta; a primeira troca de cada pedido é gratuita. Detalhes: ${absoluteUrl("/ajuda#trocas")}`,
    `- Pagamento: cartão de crédito em até ${MAX_INSTALLMENTS}x sem juros ou Pix (simulado nesta demonstração).`,
    `- Cashback: ${CASHBACK_PERCENT}% do valor de cada compra volta como crédito para a próxima, liberado após a entrega.`,
    `- Tamanhos: cada produto tem tabela de medidas da peça (não do corpo), em centímetros. Guia: ${absoluteUrl("/ajuda#medidas")}`,
    "",
  ];
}

function provador(mannequinNames: string[]) {
  return [
    "## Provador 3D",
    "",
    `O Provador 3D (${absoluteUrl("/provador")}) veste as peças num manequim 3D com a altura (${BODY_LIMITS.heightCm.min}–${BODY_LIMITS.heightCm.max} cm) e o peso (${BODY_LIMITS.weightKg.min}–${BODY_LIMITS.weightKg.max} kg) da pessoa, indica o tamanho recomendado e mostra o caimento de cada peça antes da compra. Não usa câmera nem foto.${mannequinNames.length ? ` Manequins disponíveis: ${mannequinNames.join(", ")}.` : ""}`,
    "",
    ...PROVADOR_STEPS.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`),
    "",
    `- Abrir uma peça direto no provador: ${absoluteUrl("/provador?add=")}<slug-do-produto>`,
    `- Como funciona: ${absoluteUrl("/provador#como-funciona")}`,
    "",
  ];
}

function faq(full: boolean) {
  const all = full ? [...FAQ, ...PROVADOR_FAQ] : FAQ;
  return ["## Perguntas frequentes", "", ...all.flatMap((f) => [`### ${f.q}`, "", f.a, ""])];
}

function categories(products: Product[]) {
  return [
    "## Categorias",
    "",
    ...CATEGORIES.filter((c) => products.some((p) => p.category === c.slug)).map(
      (c) => `- [${c.name}](${absoluteUrl(`/categoria/${c.slug}`)}): ${c.description}`,
    ),
    `- [Novidades](${absoluteUrl("/novidades")}): lançamentos da temporada.`,
    `- [Masculino](${absoluteUrl("/masculino")}) e [Feminino](${absoluteUrl("/feminino")}): inclui as peças unissex.`,
    "",
    "## Coleções",
    "",
    ...COLLECTIONS.filter((c) => products.some((p) => p.collection === c.name)).map(
      (c) => `- [${c.name}](${absoluteUrl(`/novidades?colecao=${c.slug}`)})`,
    ),
    "",
  ];
}

function productsShort(products: Product[]) {
  return [
    "## Produtos",
    "",
    ...products.map(
      (p) =>
        `- [${p.name}](${absoluteUrl(`/produto/${p.slug}`)}): ${priceLine(p)} · ${categoryName(p.category)} · ${GENDER[p.gender]} · cor ${p.colorName.toLowerCase()} · ${sizesLine(p)}. ${oneLine(p.description)}`,
    ),
    "",
  ];
}

const CHART_COLS: { key: keyof SizeChartRow; label: string }[] = [
  { key: "chestCm", label: "tórax/busto" },
  { key: "waistCm", label: "cintura" },
  { key: "hipCm", label: "quadril" },
  { key: "lengthCm", label: "comprimento" },
  { key: "sleeveCm", label: "manga" },
  { key: "inseamCm", label: "entrepernas" },
  { key: "footCm", label: "pé" },
  { key: "headCm", label: "cabeça" },
];

function productFull(p: Product) {
  const chart = p.sizeChart.map((r) => {
    const cols = CHART_COLS.filter((c) => typeof r[c.key] === "number").map((c) => `${c.label} ${String(r[c.key]).replace(".", ",")}`);
    return `  - ${r.size}: ${cols.join(", ")} cm`;
  });
  return [
    `### ${p.name}`,
    "",
    `- URL: ${absoluteUrl(`/produto/${p.slug}`)}`,
    `- Preço: ${priceLine(p)}, em até ${MAX_INSTALLMENTS}x sem juros`,
    `- Categoria: ${categoryName(p.category)} · Coleção: ${p.collection} · Gênero: ${GENDER[p.gender]} · Cor: ${p.colorName}`,
    `- Disponibilidade: ${sizesLine(p)}`,
    `- Modelagem: ${p.garment.silhouette}`,
    ...(p.reviewCount > 0 ? [`- Avaliação (fictícia): ${String(p.rating).replace(".", ",")} de 5 em ${p.reviewCount} avaliações`] : []),
    `- Provar no Provador 3D: ${absoluteUrl(`/provador?add=${encodeURIComponent(p.slug)}`)}`,
    "",
    oneLine(p.description),
    "",
    ...(p.details.length ? ["Características:", ...p.details.map((d) => `- ${d}`), ""] : []),
    ...(chart.length ? ["Medidas da peça (cm):", ...chart, ""] : []),
  ];
}

async function load() {
  const [{ items }, mannequins] = await Promise.all([listProducts({ sort: "relevancia" }), listMannequins()]);
  const generatedAt = new Date().toISOString().slice(0, 10);
  return { products: items, mannequinNames: mannequins.map((m) => m.name), generatedAt };
}

export async function buildLlmsTxt(): Promise<string> {
  const { products, mannequinNames, generatedAt } = await load();
  return [
    ...header(generatedAt),
    ...policies(),
    ...provador(mannequinNames),
    ...categories(products),
    ...productsShort(products),
    ...faq(false),
    "## Opcional",
    "",
    `- [Catálogo completo com medidas e perguntas do provador](${absoluteUrl("/llms-full.txt")})`,
    `- [Mapa do site](${absoluteUrl("/sitemap.xml")})`,
    `- [Ajuda](${absoluteUrl("/ajuda")})`,
    "",
  ].join("\n");
}

export async function buildLlmsFullTxt(): Promise<string> {
  const { products, mannequinNames, generatedAt } = await load();
  return [
    ...header(generatedAt),
    ...policies(),
    ...provador(mannequinNames),
    ...faq(true),
    ...categories(products),
    "## Catálogo",
    "",
    ...products.flatMap(productFull),
  ].join("\n");
}

export function textResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
