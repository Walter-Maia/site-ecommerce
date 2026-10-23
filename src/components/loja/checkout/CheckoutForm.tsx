"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { placeOrderAction } from "@/server/actions/checkout";
import type { FormState } from "@/server/actions/auth";
import { formatInstallments, formatPrice } from "@/lib/format";
import { UFS } from "../constants";
import { useStore } from "../StoreProvider";

const maskCep = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const maskExp = (v: string) => v.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
}

function Field({ name, label, error, hint, className, ...input }: FieldProps) {
  const id = `co-${name}`;
  const describedBy = [error ? `${id}-erro` : null, hint ? `${id}-dica` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {input.required ? null : <span className="font-normal text-mute"> (opcional)</span>}
      </label>
      <input id={id} name={name} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && !error ? (
        <p id={`${id}-dica`} className="mt-1.5 text-xs text-mute">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-erro`} className="mt-1.5 text-sm text-signal">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-6">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-5 flex items-baseline gap-3 font-serif text-2xl tracking-[-0.02em]" aria-hidden="true">
        <span className="t-cond tabular text-base font-semibold text-mute">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </fieldset>
  );
}

export function CheckoutForm() {
  const { cart, cartReady } = useStore();
  const [state, formAction, pending] = useActionState<FormState, FormData>(placeOrderAction, undefined);
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [cep, setCep] = useState("");
  const [cpf, setCpf] = useState("");
  const [card, setCard] = useState({ number: "", exp: "" });
  const alertRef = useRef<HTMLDivElement>(null);
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.error) alertRef.current?.focus();
  }, [state]);

  // Demo estática: o HTML do build não conhece a sacola do visitante (localStorage); evita piscar "vazia".
  if (!cartReady) return <p className="border-t border-line py-16 text-ink-2">Carregando a sacola…</p>;

  if (cart.lines.length === 0) {
    return (
      <div className="border-t border-line py-16">
        <p className="font-serif text-3xl tracking-[-0.02em]">Sua sacola está vazia.</p>
        <p className="mt-3 max-w-md text-ink-2">Adicione peças à sacola para finalizar a compra.</p>
        <Link href="/novidades" className="btn btn-solid mt-8">
          Ver novidades
        </Link>
      </div>
    );
  }

  return (
    <form
      id="checkout-form"
      action={formAction}
      onSubmit={(e) => {
        // Com JS, envia sem o reset automático do React (mantém o que foi digitado se houver erro).
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      noValidate
      className="grid gap-10 lg:grid-cols-12 lg:gap-14"
    >
      <div className="space-y-10 lg:col-span-7">
        {state?.error ? (
          <div ref={alertRef} tabIndex={-1} role="alert" className="border-l-2 border-signal bg-sand px-4 py-3 text-sm outline-none">
            {state.error}
          </div>
        ) : null}

        <Step n={1} title="Contato">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Nome completo" autoComplete="name" required error={fe.name} className="sm:col-span-2" />
            <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required error={fe.email} hint="Enviamos a confirmação e o rastreio para cá." />
            <Field
              name="cpf"
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              error={fe.cpf}
              hint="Para a nota fiscal."
            />
          </div>
        </Step>

        <Step n={2} title="Entrega">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field
              name="cep"
              label="CEP"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
              placeholder="00000-000"
              error={fe.cep}
              className="sm:col-span-2"
            />
            <Field name="street" label="Rua" autoComplete="address-line1" required error={fe.street} className="sm:col-span-4" />
            <Field name="number" label="Número" inputMode="numeric" autoComplete="off" required error={fe.number} className="sm:col-span-2" />
            <Field name="complement" label="Complemento" autoComplete="address-line2" error={fe.complement} className="sm:col-span-4" />
            <Field name="district" label="Bairro" autoComplete="address-level3" required error={fe.district} className="sm:col-span-3" />
            <Field name="city" label="Cidade" autoComplete="address-level2" required error={fe.city} className="sm:col-span-2" />
            <div className="sm:col-span-1">
              <label htmlFor="co-state" className="mb-1.5 block text-sm font-medium">
                UF
              </label>
              <select
                id="co-state"
                name="state"
                required
                autoComplete="address-level1"
                defaultValue=""
                className="field"
                aria-invalid={fe.state ? true : undefined}
                aria-describedby={fe.state ? "co-state-erro" : undefined}
              >
                <option value="" disabled>
                  —
                </option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              {fe.state ? (
                <p id="co-state-erro" className="mt-1.5 text-sm text-signal">
                  {fe.state}
                </p>
              ) : null}
            </div>
          </div>
        </Step>

        <Step n={3} title="Pagamento">
          <p className="mb-5 border-l-2 border-ink bg-sand px-4 py-3 text-sm">
            <strong>Pagamento simulado — nenhum valor é cobrado.</strong> Esta loja é uma demonstração.
          </p>
          <div role="radiogroup" aria-label="Forma de pagamento" className="grid gap-2.5 sm:grid-cols-2">
            {(
              [
                { v: "pix", t: "Pix", d: "Aprovação na hora" },
                { v: "cartao", t: "Cartão de crédito", d: formatInstallments(cart.total) },
              ] as const
            ).map((o) => (
              <div key={o.v}>
                <input
                  type="radio"
                  id={`co-pay-${o.v}`}
                  name="paymentMethod"
                  value={o.v}
                  checked={method === o.v}
                  onChange={() => setMethod(o.v)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`co-pay-${o.v}`}
                  className="flex min-h-16 cursor-pointer flex-col justify-center border border-line px-4 py-3 transition-colors hover:border-ink peer-checked:border-ink peer-checked:shadow-[inset_0_0_0_1px_var(--ink)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                >
                  <span className="font-medium">{o.t}</span>
                  <span className="text-sm text-mute">{o.d}</span>
                </label>
              </div>
            ))}
          </div>
          {fe.paymentMethod ? <p className="mt-2 text-sm text-signal">{fe.paymentMethod}</p> : null}

          {method === "cartao" ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-6">
              <p className="text-xs text-mute sm:col-span-6">
                Os dados do cartão ficam só nesta tela: os campos abaixo não são enviados ao servidor.
              </p>
              {/* Sem atributo name: nunca entram no FormData. */}
              <div className="sm:col-span-6">
                <label htmlFor="cc-number" className="mb-1.5 block text-sm font-medium">
                  Número do cartão
                </label>
                <input id="cc-number" className="field tabular" inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 0000" value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: maskCard(e.target.value) }))} />
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="cc-name" className="mb-1.5 block text-sm font-medium">
                  Nome impresso no cartão
                </label>
                <input id="cc-name" className="field" autoComplete="off" />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="cc-exp" className="mb-1.5 block text-sm font-medium">
                  Validade
                </label>
                <input id="cc-exp" className="field tabular" inputMode="numeric" autoComplete="off" placeholder="MM/AA" value={card.exp} onChange={(e) => setCard((c) => ({ ...c, exp: maskExp(e.target.value) }))} />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="cc-cvv" className="mb-1.5 block text-sm font-medium">
                  Código de segurança
                </label>
                <input id="cc-cvv" className="field tabular" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="CVV" />
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ink-2">O QR Code do Pix (simulado) aparece na confirmação do pedido.</p>
          )}
        </Step>

        <div className="border-t border-line pt-6 lg:hidden">
          <SubmitButton pending={pending} total={cart.total} />
        </div>
      </div>

      <aside aria-labelledby="resumo-pedido" className="lg:col-span-5">
        <div className="bg-sand p-6 md:p-8 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <h2 id="resumo-pedido" className="font-serif text-2xl tracking-[-0.02em]">
            Seu pedido
          </h2>
          <ul className="mt-5 divide-y divide-ink/10">
            {cart.lines.map((l) => (
              <li key={l.lineId} className="flex gap-3 py-3">
                <div className="relative w-14 shrink-0">
                  <div className="media aspect-[4/5] bg-paper">
                    <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                  <span className="tabular absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-ink text-[0.65rem] text-paper">
                    {l.quantity}
                    <span className="sr-only"> {l.quantity === 1 ? "unidade" : "unidades"}</span>
                  </span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-serif text-[0.98rem] leading-snug">{l.name}</p>
                  <p className="text-mute">Tamanho {l.size}</p>
                </div>
                <p className="tabular text-sm">{formatPrice(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-ink/15 pt-4 text-[0.95rem]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tabular">{formatPrice(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Frete</dt>
              <dd className="tabular">{cart.shipping === 0 ? "Grátis" : formatPrice(cart.shipping)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink/15 pt-4 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatPrice(cart.total)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-right text-xs text-ink-2">Valores recalculados no servidor ao confirmar.</p>
          <div className="mt-6 hidden lg:block">
            <SubmitButton pending={pending} total={cart.total} />
          </div>
          <Link href="/carrinho" className="link-line mx-auto mt-4 flex min-h-11 w-fit items-center text-sm">
            Voltar para a sacola
          </Link>
        </div>
      </aside>
    </form>
  );
}

function SubmitButton({ pending, total }: { pending: boolean; total: number }) {
  return (
    <button type="submit" disabled={pending} className={clsx("btn btn-solid w-full", pending && "cursor-progress")}>
      {pending ? "Confirmando pedido…" : `Finalizar pedido · ${formatPrice(total)}`}
    </button>
  );
}
