"use client";
import { useActionState } from "react";
import { FormAlert } from "@/components/conta/Field";
import type { FormState } from "@/server/actions/auth";
import { deleteMannequinAction } from "@/server/admin/actions";

export function DeleteMannequinForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteMannequinAction, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Apagar o manequim ${name}? Essa ação não pode ser desfeita.`)) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      {state?.error ? <FormAlert>{state.error}</FormAlert> : null}
      <button type="submit" className="btn border-signal text-signal" disabled={pending}>
        {pending ? "Apagando…" : "Apagar manequim"}
      </button>
    </form>
  );
}
