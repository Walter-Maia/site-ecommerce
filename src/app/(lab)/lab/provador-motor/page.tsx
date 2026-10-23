import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LabClient from "./LabClient";

export const metadata: Metadata = {
  title: "Laboratório · Motor do Provador 3D",
  description: "Bancada interna para testar o manequim procedural, as roupas e o caimento.",
  robots: { index: false, follow: false, nocache: true },
};

type Search = Record<string, string | string[] | undefined>;

/** Bancada do motor 3D (sem indexação). Aceita parâmetros de URL para capturas de QA. */
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  // Bancada interna: fora do ar em produção, salvo opt-in explícito.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_LAB !== "1") notFound();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined));
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : []);
  const params: Record<string, string> = {};
  for (const k of Object.keys(sp)) {
    const v = one(k);
    if (v !== undefined && k !== "v") params[k] = v;
  }
  return <LabClient params={params} variants={many("v")} />;
}
