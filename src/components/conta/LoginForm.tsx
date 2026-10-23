"use client";
import { useActionState, useState } from "react";
import { loginAction, type FormState } from "@/server/actions/auth";
import { Field, FormAlert } from "./Field";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  // Controlado: o React limpa campos não controlados após a ação; o e-mail fica.
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={state?.fieldErrors?.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state?.fieldErrors?.password}
      />
      {state?.error ? <FormAlert>{state.error}</FormAlert> : null}
      <button type="submit" className="btn btn-solid w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
