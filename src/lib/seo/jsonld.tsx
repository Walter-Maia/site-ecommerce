import { FAQ, FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, SITE } from "@/data/site";
import type { Product } from "@/lib/types";

/**
 * Builders de dados estruturados (schema.org) + componente <JsonLd>.
 * Escapa "<" para impedir quebra do <script> (XSS) — nunca usar JSON.stringify cru.
 */

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json | Json[] }) {
  // Barra dupla: no fonte, "\u003c" com uma barra seria o próprio "<" e nada seria escapado.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export const absoluteUrl = (path = "/") => new URL(path, SITE.url).toString();

export function organizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": absoluteUrl("/#organizacao"),
    name: SITE.name,
    legalName: SITE.legalName,
    description: SITE.description,
    url: absoluteUrl("/"),
    // PNG 512×512: o Google pede logo rasterizável de no mínimo 112 px.
    logo: absoluteUrl("/images/icons/icon-512.png"),
    foundingDate: String(SITE.foundingYear),
    email: SITE.email,
    address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "BR" },
    sameAs: [SITE.instagram],
  };
}

export function websiteJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#site"),
    name: SITE.name,
    url: absoluteUrl("/"),
    inLanguage: "pt-BR",
    publisher: { "@id": absoluteUrl("/#organizacao") },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/busca?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  };
}

export function productJsonLd(p: Product): Json {
  const inStock = p.sizes.some((s) => s.stock > 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": absoluteUrl(`/produto/${p.slug}#produto`),
    name: p.name,
    description: p.description,
    sku: p.id.toUpperCase(),
    image: p.images.map((i) => absoluteUrl(i.src)),
    color: p.colorName,
    brand: { "@type": "Brand", name: SITE.name },
    category: p.category,
    audience: { "@type": "PeopleAudience", suggestedGender: p.gender === "unissex" ? "unisex" : p.gender === "feminino" ? "female" : "male" },
    additionalProperty: p.details.map((d) => {
      const [name, ...rest] = d.split(":");
      return { "@type": "PropertyValue", name: name.trim(), value: rest.join(":").trim() || name.trim() };
    }),
    aggregateRating: p.reviewCount > 0 ? { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount } : undefined,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/produto/${p.slug}`),
      priceCurrency: "BRL",
      price: (p.price / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": absoluteUrl("/#organizacao") },
      // Frete da peça sozinha: grátis a partir de FREE_SHIPPING_THRESHOLD, senão taxa fixa para todo o Brasil.
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", currency: "BRL", value: (p.price >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING / 100).toFixed(2) },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "BR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnFees: "https://schema.org/FreeReturn",
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function itemListJsonLd(products: Product[], name: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/produto/${p.slug}`), name: p.name })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[] = FAQ): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
