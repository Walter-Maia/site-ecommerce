import type { Metadata } from "next";
import "@/components/provador/provador.css";
import FittingRoom from "@/components/provador/FittingRoom";
import { loadProvadorData } from "@/components/provador/data.server";
import { SITE } from "@/data/site";
import { absoluteUrl, faqJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { openGraph, PROVADOR_OG_IMAGE } from "@/lib/seo/metadata";
import { BODY_LIMITS } from "@/lib/types";
import { PROVADOR_FAQ, PROVADOR_STEPS } from "./faq";

const TITLE = "Provador 3D: veja o caimento pela sua altura e peso";
const DESCRIPTION = `Vista as peças da ${SITE.name} num manequim 3D com sua altura e peso, veja o tamanho recomendado e o caimento de cada peça, salve o look e compre tudo de uma vez.`;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/provador" },
    openGraph: openGraph({
      url: "/provador",
      title: `${TITLE} | ${SITE.name}®`,
      description: DESCRIPTION,
      images: [PROVADOR_OG_IMAGE],
    }),
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [PROVADOR_OG_IMAGE] },
  };
}

/** Os mesmos passos visíveis em #como-funciona, como HowTo (útil para mecanismos de resposta). */
const HOWTO_JSONLD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: `Como usar o Provador 3D da ${SITE.name}`,
  description: `Monte o look num manequim 3D com a sua altura (${BODY_LIMITS.heightCm.min}–${BODY_LIMITS.heightCm.max} cm) e o seu peso (${BODY_LIMITS.weightKg.min}–${BODY_LIMITS.weightKg.max} kg) e veja o tamanho recomendado e o caimento antes de comprar.`,
  inLanguage: "pt-BR",
  tool: [{ "@type": "HowToTool", name: "Navegador com WebGL (celular ou computador)" }],
  step: PROVADOR_STEPS.map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: s.title,
    text: s.text,
    url: absoluteUrl("/provador#como-funciona"),
  })),
};

const LOOK_ID = /^[a-z0-9-]{1,64}$/i;
const SLUG = /^[a-z0-9-]{1,96}$/;

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

export default async function ProvadorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawLook = one(sp.look);
  const rawAdd = one(sp.add);
  const look = rawLook && LOOK_ID.test(rawLook) ? rawLook : undefined;
  const add = rawAdd && SLUG.test(rawAdd) ? rawAdd : undefined;
  const data = await loadProvadorData({ lookId: look });

  return (
    <main id="conteudo">
      <JsonLd data={[faqJsonLd(PROVADOR_FAQ), HOWTO_JSONLD]} />
      {data.mannequins.length ? (
        <FittingRoom
          data={data}
          initialLookId={look}
          initialAddSlug={add}
        />
      ) : (
        <section className="px-4 py-24 text-center">
          <h1 className="font-serif text-4xl">Provador 3D</h1>
          <p className="mt-4 text-mute">O provador da {SITE.name} está em manutenção. Volte em instantes.</p>
        </section>
      )}

      <section id="como-funciona" aria-labelledby="como-funciona-h" className="pv-howto">
        <div className="pv-howto__inner">
          <p className="pv-howto__kicker">Provador {SITE.name} · guia rápido</p>
          <h2 id="como-funciona-h" className="pv-howto__title">
            Como funciona o Provador 3D?
          </h2>
          <p className="pv-howto__lead">
            Você monta o look num manequim 3D com a sua altura ({BODY_LIMITS.heightCm.min}–{BODY_LIMITS.heightCm.max} cm) e o seu peso (
            {BODY_LIMITS.weightKg.min}–{BODY_LIMITS.weightKg.max} kg). O provador estima suas medidas e compara com a tabela de cada peça
            para indicar o tamanho e mostrar o caimento antes da compra.
          </p>
          <ol className="pv-howto__steps">
            {PROVADOR_STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="pv-howto__n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>

          <h2 className="pv-howto__title pv-howto__title--sm">Perguntas sobre o provador</h2>
          <div className="pv-howto__faq">
            {PROVADOR_FAQ.map((f) => (
              <article key={f.id} id={`faq-${f.id}`}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
