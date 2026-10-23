"use client";
import { useTransition } from "react";
import { deleteLook } from "@/server/actions/looks";

export function DeleteLookButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="t-label text-mute underline-offset-4 hover:text-signal hover:underline disabled:opacity-50"
      disabled={pending}
      aria-label={`Apagar o look ${name}`}
      onClick={() => {
        if (!window.confirm(`Apagar o look "${name}"?`)) return;
        start(async () => {
          await deleteLook({ id });
        });
      }}
    >
      {pending ? "Apagando…" : "Apagar"}
    </button>
  );
}
