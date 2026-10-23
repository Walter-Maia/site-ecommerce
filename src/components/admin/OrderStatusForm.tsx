"use client";
import { useActionState, useState } from "react";
import { FormAlert } from "@/components/conta/Field";
import { ORDER_STATUS_LABEL } from "@/components/conta/labels";
import type { FormState } from "@/server/actions/auth";
import { updateOrderStatusAction } from "@/server/admin/actions";

type Status = keyof typeof ORDER_STATUS_LABEL;

export function OrderStatusForm({ id, status }: { id: string; status: Status }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateOrderStatusAction, undefined);
  const [value, setValue] = useState<Status>(status);
  const locked = status === "cancelado";

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <label htmlFor="status" className="t-label block text-ink-2">
        Status do pedido
      </label>
      <select
        id="status"
        name="status"
        value={value}
        disabled={locked}
        onChange={(e) => setValue(e.target.value as Status)}
        className="block min-h-12 w-full border border-line bg-paper px-3 text-base outline-none focus:border-ink disabled:opacity-60"
      >
        {(Object.keys(ORDER_STATUS_LABEL) as Status[]).map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {value === "cancelado" && !locked ? (
        <p className="text-sm text-ink-2">Cancelar devolve as peças ao estoque. Pedido cancelado não pode ser reaberto.</p>
      ) : null}
      {locked ? <p className="text-sm text-mute">Pedido cancelado: status final.</p> : null}
      {state?.error ? <FormAlert>{state.error}</FormAlert> : null}
      {state?.success ? <FormAlert tone="ok">Status atualizado.</FormAlert> : null}
      {!locked ? (
        <button type="submit" className="btn btn-solid w-full" disabled={pending || value === status}>
          {pending ? "Salvando…" : "Atualizar status"}
        </button>
      ) : null}
    </form>
  );
}
