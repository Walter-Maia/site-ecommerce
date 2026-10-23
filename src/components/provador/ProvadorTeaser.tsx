import "./provador.css";
import Link from "next/link";
import type { WornItem } from "@/lib/provador/contract";
import { estimateMeasurements } from "@/lib/provador/fit";
import { dressItem, sortByLayer } from "@/lib/provador/outfit";
import { SITE } from "@/data/site";
import { listCuratedLooks, listProducts } from "@/server/catalog";
import { listMannequins } from "@/server/mannequins";
import { publicImage, toProvadorProduct } from "./data.server";
import { pickSize } from "./slots";
import { TeaserStage } from "./TeaserStage";
import { LookThumb } from "./ui/LookThumb";
import type { PosterColors } from "./ui/PosterFigure";

/**
 * Teaser do provador na home (Server Component sem props). Leve: pôster em SVG no HTML;
 * o 3D só é baixado quando o palco entra na viewport.
 */
export default async function ProvadorTeaser() {
  const [{ items }, mannequins, curated] = await Promise.all([listProducts({ sort: "relevancia" }), listMannequins(), listCuratedLooks()]);
  const mq = mannequins[0];
  if (!mq) return null;

  const products = items.map(toProvadorProduct);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const names = new Map(mannequins.map((m) => [m.id, m.name]));
  const looks = curated.filter((l) => !l.locked && names.has(l.mannequinId) && l.productSlugs.some((s) => bySlug.has(s)));
  const hero = looks.find((l) => l.mannequinId === mq.id) ?? looks[0];
  const withImage = looks.map((l) => ({ l, image: publicImage(l.thumbnail ?? `/images/provador/looks/${l.id}.webp`) }));
  const tiles = [...withImage.filter((t) => t.image), ...withImage.filter((t) => !t.image)].slice(0, 4);

  const m = estimateMeasurements({ body: mq.body, heightCm: mq.heightCm, weightKg: mq.weightKg });
  const outfit: WornItem[] = sortByLayer(
    (hero?.productSlugs ?? []).flatMap((slug) => {
      const p = bySlug.get(slug);
      if (!p) return [];
      // só o que o motor precisa vai para o cliente
      const garment = { id: p.id, slug: p.slug, name: p.name, shortName: p.shortName, garment: p.garment, sizeChart: p.sizeChart, colorName: p.colorName, colorHex: p.colorHex };
      return [dressItem(garment, m, pickSize(p, m))];
    }),
  );
  const colorOf = (slot: string) => outfit.find((w) => w.product.garment.slot === slot)?.product.garment.colors.base;
  const poster: PosterColors = {
    skin: mq.skinTone,
    hair: mq.hairColor,
    head: colorOf("head"),
    top: colorOf("top"),
    outer: colorOf("outer"),
    bottom: colorOf("bottom"),
    full: colorOf("full"),
    feet: colorOf("feet"),
    feminine: mq.body === "feminino",
  };
  const label = `Manequim ${mq.name} vestindo ${outfit.map((w) => w.product.name).join(", ") || "o look do dia"}.`;
  const colors = (slugs: string[]) => slugs.flatMap((s) => (bySlug.get(s) ? [bySlug.get(s)!.garment.colors.base] : []));

  return (
    <section className="pv-teaser" aria-labelledby="pv-teaser-h">
      <div className="pv-teaser__inner">
        <div className="pv-teaser__copy">
          <p className="pv-kicker" lang="en">
            Select your fit
          </p>
          <h2 id="pv-teaser-h" className="pv-teaser__title">
            Provador 3D
          </h2>
          <p className="pv-teaser__lead">
            Escolha o manequim, informe altura e peso e veja o caimento de cada peça da {SITE.name} antes de comprar.
          </p>
          {tiles.length ? (
            <ul className="pv-teaser__looks" aria-label="Looks prontos para provar">
              {tiles.map(({ l, image }) => (
                <li key={l.id}>
                  <Link href={`/provador?look=${encodeURIComponent(l.id)}`} className="pv-teaser__look" aria-label={`${l.name}: provar no Provador 3D`}>
                    <LookThumb image={image} colors={colors(l.productSlugs)} sizes="(max-width: 767px) 22vw, 120px" />
                    <span>{l.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Link href="/provador" className="btn btn-solid">
              Abrir provador
            </Link>
          </div>
        </div>
        <div className="pv-teaser__stage">
          <TeaserStage
            bodyParams={{ body: mq.body, heightCm: mq.heightCm, weightKg: mq.weightKg }}
            appearance={{ skinTone: mq.skinTone, hairStyle: mq.hairStyle, hairColor: mq.hairColor, style: mq.style }}
            outfit={outfit}
            poster={poster}
            label={label}
          />
        </div>
      </div>
    </section>
  );
}
