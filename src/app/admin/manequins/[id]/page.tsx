import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteMannequinForm } from "@/components/admin/DeleteMannequinForm";
import { MannequinForm } from "@/components/admin/MannequinForm";
import { PageHeader } from "@/components/admin/ui";
import { FormAlert } from "@/components/conta/Field";
import { getMannequinForAdmin, mannequinInUse } from "@/server/admin/mannequins";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Editar manequim" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditarManequim({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const m = getMannequinForAdmin(id);
  if (!m) notFound();
  const { id: _id, ...initial } = m;

  return (
    <>
      <PageHeader
        eyebrow="Manequins"
        title={m.name}
        actions={
          <Link href="/admin/manequins" className="btn">
            Voltar
          </Link>
        }
      >
        <p className="mt-2 text-sm text-mute">{_id}</p>
      </PageHeader>
      {sp.salvo ? (
        <div className="mb-6 max-w-md">
          <FormAlert tone="ok">Manequim criado.</FormAlert>
        </div>
      ) : null}
      <MannequinForm key={m.id} id={m.id} initial={initial} />

      <section aria-labelledby="zona-perigo" className="mt-14 max-w-xl border-t border-line pt-8">
        <h2 id="zona-perigo" className="font-serif text-2xl">
          Apagar
        </h2>
        {mannequinInUse(m.id) ? (
          <p className="mt-3 text-sm text-ink-2">Este manequim é usado nos looks editoriais do provador. Para tirá-lo do ar, desmarque “Ativo”.</p>
        ) : (
          <div className="mt-4">
            <DeleteMannequinForm id={m.id} name={m.name} />
          </div>
        )}
      </section>
    </>
  );
}
