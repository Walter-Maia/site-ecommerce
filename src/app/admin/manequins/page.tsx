import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/conta/Field";
import { HAIR_STYLE_LABEL } from "@/components/conta/labels";
import { PageHeader, Swatch } from "@/components/admin/ui";
import { listMannequins } from "@/server/mannequins";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Manequins" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminManequins({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const mannequins = await listMannequins({ includeInactive: true });

  return (
    <>
      <PageHeader
        eyebrow="Provador 3D"
        title="Manequins"
        actions={
          <Link href="/admin/manequins/novo" className="btn btn-solid">
            Novo manequim
          </Link>
        }
      >
        <p className="mt-2 text-sm text-mute">O cliente vê só os ativos, nesta ordem.</p>
      </PageHeader>

      {sp.apagado ? (
        <div className="mb-6 max-w-md">
          <FormAlert tone="ok">Manequim apagado.</FormAlert>
        </div>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mannequins.map((m) => (
          <li key={m.id} className="flex flex-col justify-between gap-5 border border-line p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="font-serif text-2xl">{m.name}</p>
                <span className={m.active ? "t-label border border-ink px-2 py-1" : "t-label border border-line px-2 py-1 text-mute"}>
                  {m.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="mt-1 text-sm text-mute">
                #{m.sortOrder} · corpo {m.body} · {m.style} · {m.heightCm} cm · {m.weightKg} kg
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
                <Swatch hex={m.skinTone} label="Pele" /> <Swatch hex={m.hairColor} label="Cabelo" /> {HAIR_STYLE_LABEL[m.hairStyle]}
              </p>
            </div>
            <Link href={`/admin/manequins/${m.id}`} className="btn" aria-label={`Editar ${m.name}`}>
              Editar
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
