import type { Metadata } from "next";
import Link from "next/link";
import { MannequinForm } from "@/components/admin/MannequinForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Novo manequim" };

export default async function NovoManequim() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        eyebrow="Manequins"
        title="Novo manequim"
        actions={
          <Link href="/admin/manequins" className="btn">
            Voltar
          </Link>
        }
      />
      <MannequinForm />
    </>
  );
}
