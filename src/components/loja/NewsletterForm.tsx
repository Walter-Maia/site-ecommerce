"use client";

import { useActionState, useId } from "react";
import clsx from "clsx";
import { subscribeNewsletterAction } from "@/server/actions/newsletter";
import type { FormState } from "@/server/actions/auth";

/** Inscrição "Seja membro". Funciona sem JS (Server Action no action do form). */
export function NewsletterForm({ tone = "light", cta = "Quero entrar" }: { tone?: "light" | "dark"; cta?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeNewsletterAction, undefined);
  const id = useId();
  const err = state?.fieldErrors?.email ?? state?.error;
  const dark = tone === "dark";

  if (state?.success) {
    return (
      <p role="status" className={clsx("font-serif text-2xl leading-snug tracking-[-0.01em]", dark ? "text-white" : "text-ink")}>
        Pronto, você está na lista. O primeiro aviso chega antes do próximo drop.
      </p>
    );
  }

  return (
    <form action={action} noValidate={false} className="w-full">
      <label htmlFor={`${id}-email`} className={clsx("t-label mb-2 block", dark ? "text-white" : "text-mute")}>
        Seu e-mail
      </label>
      <div className={clsx("underline-field flex border-b", dark ? "border-white" : "border-ink")}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="nome@email.com"
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-erro` : undefined}
          className={clsx(
            "no-ring min-h-12 w-full min-w-0 bg-transparent text-base outline-none",
            dark ? "text-white placeholder:text-white/60" : "text-ink placeholder:text-mute",
          )}
        />
        <button
          type="submit"
          disabled={pending}
          className={clsx("t-label shrink-0 px-1 py-3 underline-offset-4 hover:underline disabled:opacity-60", dark ? "text-white" : "text-ink")}
        >
          {pending ? "Enviando…" : cta}
        </button>
      </div>
      {err ? (
        <p id={`${id}-erro`} role="alert" className={clsx("mt-2 text-sm", dark ? "text-white" : "text-signal")}>
          {err}
        </p>
      ) : null}
    </form>
  );
}
