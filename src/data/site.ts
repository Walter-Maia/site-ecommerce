import type { Category } from "@/lib/types";

/**
 * Configuração da loja. KIM & KRIS é uma DISTRIBUIDORA de streetwear: o nome e o
 * selo identificam a loja, não as peças (nenhuma roupa leva o nome da loja).
 * Trocar nome/URL aqui propaga para header, footer, metadados, JSON-LD, sitemap e llms.txt.
 */
export const SITE = {
  name: "KIM & KRIS",
  legalName: "Kim & Kris Streetwear",
  tagline: "Loja de streetwear desde 1999",
  description:
    "KIM & KRIS é uma loja de streetwear desde 1999: camisetas oversized, jerseys, moletons, flanelas, calças cargo, tênis de skate e alfaiataria. Monte looks no Provador 3D, ajuste altura e peso e veja o caimento antes de comprar.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "pt_BR",
  foundingYear: 1999,
  /** Cidade da loja: vazio enquanto não for confirmada (não inventar endereço de empresa real). */
  city: "",
  logo: "/images/brand/kim-e-kris-selo-512.webp",
  email: "atendimento@kimekris.test",
  instagram: "https://www.instagram.com/",
  currency: "BRL",
} as const;

/** Frete grátis a partir deste subtotal (centavos). */
export const FREE_SHIPPING_THRESHOLD = 29900;
export const FLAT_SHIPPING = 2490;
export const MAX_INSTALLMENTS = 6;
export const CASHBACK_PERCENT = 10;

export const ANNOUNCEMENTS = [
  "Frete grátis acima de R$ 299",
  `${CASHBACK_PERCENT}% de cashback para a próxima compra`,
  `Até ${MAX_INSTALLMENTS}x sem juros`,
  "Novo: Provador 3D — vista antes de comprar",
  "Chegou a linha Rolê: skate e streetwear",
] as const;

export const CATEGORIES: Category[] = [
  { slug: "camisetas", name: "Camisetas", description: "Camisetas oversized e baby tees em algodão pesado com estampas varsity e script." },
  { slug: "regatas-e-tops", name: "Regatas e tops", description: "Regatas machão e tops canelados para a quadra e para a rua." },
  { slug: "jerseys", name: "Jerseys", description: "Camisas de baseball e basquete com numeração e tecido mesh." },
  { slug: "camisas", name: "Camisas", description: "Camisas oxford de botão para looks mais arrumados." },
  { slug: "moletons", name: "Moletons", description: "Moletons canguru, careca e cropped em felpa de 400 g/m²." },
  { slug: "jaquetas", name: "Jaquetas", description: "Varsity, corta-vento e blazers com pegada esportiva." },
  { slug: "alfaiataria", name: "Alfaiataria", description: "Blazers, calças de pregas e wide leg: o formal com atitude de rua." },
  { slug: "bermudas", name: "Bermudas", description: "Bermudas mesh e de moletom com caimento largo." },
  { slug: "calcas", name: "Calças", description: "Calças de moletom wide, jeans baggy e alfaiataria." },
  { slug: "saias", name: "Saias", description: "Saias jeans cintura baixa e midi de cetim." },
  { slug: "vestidos", name: "Vestidos", description: "Vestido jersey oversized e slip dress de cetim." },
  { slug: "bones", name: "Bonés e gorros", description: "Dad hats, five panels e gorros canelados." },
  { slug: "calcados", name: "Calçados", description: "Tênis de quadra, tênis de skate vulcanizados e mocassins de couro." },
  { slug: "skate", name: "Skate", description: "Skates completos com shape de maple 8,25\" e peças da linha Rolê." },
];

export const NAV = {
  primary: [
    { label: "Novidades", href: "/novidades" },
    { label: "Masculino", href: "/masculino" },
    { label: "Feminino", href: "/feminino" },
    { label: "Skate", href: "/novidades?colecao=role" },
    { label: "Provador 3D", href: "/provador" },
  ],
  footer: [
    { title: "Loja", links: [
      { label: "Camisetas", href: "/categoria/camisetas" },
      { label: "Moletons", href: "/categoria/moletons" },
      { label: "Jerseys", href: "/categoria/jerseys" },
      { label: "Skate", href: "/categoria/skate" },
      { label: "Alfaiataria", href: "/categoria/alfaiataria" },
    ] },
    { title: "Ajuda", links: [
      { label: "Perguntas frequentes", href: "/ajuda" },
      { label: "Trocas e devoluções", href: "/ajuda#trocas" },
      { label: "Tabela de medidas", href: "/ajuda#medidas" },
      { label: "Como funciona o Provador 3D", href: "/provador#como-funciona" },
    ] },
  ],
} as const;

/**
 * Perguntas e respostas curtas e diretas (AEO): usadas na página /ajuda,
 * no FAQPage JSON-LD e no llms.txt. Respostas autocontidas, sem "clique aqui".
 */
export const FAQ: { id: string; q: string; a: string }[] = [
  { id: "provador", q: "Como funciona o Provador 3D da KIM & KRIS?", a: "Você escolhe um manequim, informa altura e peso, e veste as peças que curtiu. O provador recalcula o corpo e mostra o caimento de cada tamanho (justo, regular ou largo) antes de você comprar. Dá para trocar tom de pele, cabelo e o estilo do manequim (formal ou informal) e salvar o look para comprar tudo de uma vez." },
  { id: "medidas", q: "Como escolher meu tamanho?", a: "Compare a tabela de medidas da peça com uma roupa que você já usa, ou use o Provador 3D com sua altura e peso: ele indica o tamanho recomendado e mostra como cada tamanho veste no corpo." },
  { id: "frete", q: "Qual o prazo e o valor do frete?", a: "O frete é grátis acima de R$ 299. Abaixo disso, a taxa é fixa de R$ 24,90 para todo o Brasil, com código de rastreio enviado por e-mail." },
  { id: "trocas", q: "Como faço uma troca ou devolução?", a: "Você tem 30 dias após o recebimento para trocar ou devolver peças sem uso e com etiqueta. A primeira troca é gratuita." },
  { id: "pagamento", q: "Quais formas de pagamento são aceitas?", a: "Cartão de crédito em até 6x sem juros e Pix. Nesta demonstração o pagamento é simulado e nenhum valor é cobrado." },
  { id: "cashback", q: "Como funciona o cashback?", a: "Cada compra gera 10% do valor em cashback para usar na próxima compra, creditado na sua conta após a entrega." },
  { id: "tecido", q: "Qual o tecido das camisetas oversized?", a: "Algodão 100% penteado de 220 g/m², com gola canelada reforçada e ombro caído." },
];
