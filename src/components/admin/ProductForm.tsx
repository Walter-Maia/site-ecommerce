"use client";
import { useActionState, useState } from "react";
import { Field, FormAlert } from "@/components/conta/Field";
import type { FormState } from "@/server/actions/auth";
import { updateProductAction } from "@/server/admin/actions";

export interface ProductFormData {
  id: string;
  price: number;
  compareAtPrice: number | null;
  isNew: boolean;
  isFeatured: boolean;
  sizes: { size: string; stock: number }[];
}

const toBRL = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export function ProductForm({ product }: { product: ProductFormData }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProductAction, undefined);
  const [price, setPrice] = useState(toBRL(product.price));
  const [compareAt, setCompareAt] = useState(toBRL(product.compareAtPrice));
  const [isNew, setIsNew] = useState(product.isNew);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [stock, setStock] = useState<Record<string, string>>(
    Object.fromEntries(product.sizes.map((s) => [s.size, String(s.stock)])),
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="id" value={product.id} />

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-serif text-xl">Preço</legend>
        <Field
          label="Preço (R$)"
          name="price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={fe.price}
          hint="Ex.: 189,90"
        />
        <Field
          label="Preço “de” (R$)"
          name="compareAtPrice"
          inputMode="decimal"
          value={compareAt}
          onChange={(e) => setCompareAt(e.target.value)}
          error={fe.compareAtPrice}
          hint="Opcional. Deixe vazio para tirar a promoção."
        />
      </fieldset>

      <fieldset>
        <legend className="mb-4 font-serif text-xl">Estoque por tamanho</legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {product.sizes.map((s) => (
            <Field
              key={s.size}
              label={s.size}
              name={`stock:${s.size}`}
              type="number"
              min={0}
              max={9999}
              step={1}
              inputMode="numeric"
              value={stock[s.size] ?? ""}
              onChange={(e) => setStock((prev) => ({ ...prev, [s.size]: e.target.value }))}
              error={fe[`stock:${s.size}`]}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-4 font-serif text-xl">Vitrine</legend>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" name="isFeatured" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-4 accent-ink" />
          Destaque (aparece primeiro em “relevância”)
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" name="isNew" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="size-4 accent-ink" />
          Novidade (selo “novo” e página Novidades)
        </label>
      </fieldset>

      {state?.error ? <FormAlert>{state.error}</FormAlert> : null}
      {state?.success ? <FormAlert tone="ok">Produto salvo.</FormAlert> : null}
      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
