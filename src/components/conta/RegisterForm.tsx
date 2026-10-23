"use client";
import { useActionState, useState } from "react";
import { registerAction, type FormState } from "@/server/actions/auth";
import { Field, FormAlert } from "./Field";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <Field
        label="Nome"
        name="name"
        autoComplete="name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={state?.fieldErrors?.name}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={state?.fieldErrors?.email}
      />
      <div>
        <Field
          label="Senha"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          hint="Mínimo de 10 caracteres. Evite senhas óbvias ou usadas em outros sites."
          error={state?.fieldErrors?.password}
        />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-ink" />
          Mostrar senha
        </label>
      </div>
      {state?.error ? <FormAlert>{state.error}</FormAlert> : null}
      <button type="submit" className="btn btn-solid w-full" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </button>
    </form>
  );
}
