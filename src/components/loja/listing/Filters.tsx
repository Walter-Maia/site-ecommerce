import Form from "next/form";
import clsx from "clsx";
import type { Category, ProductSort, Size } from "@/lib/types";
import { COLLECTIONS, PRICE_RANGES, SORTS } from "../constants";
import { IconChevron } from "../icons";
import { AutoSubmit } from "./AutoSubmit";
import type { ListingFilters } from "./query";

export interface FacetConfig {
  categories?: Category[];
  gender?: boolean;
  collection?: boolean;
  sizes: Size[];
}

function Option({ type, name, value, checked, label, id }: { type: "radio" | "checkbox"; name: string; value: string; checked: boolean; label: string; id: string }) {
  return (
    <li>
      <input type={type} name={name} value={value} defaultChecked={checked} id={id} className="peer sr-only" />
      <label
        htmlFor={id}
        className="flex min-h-10 cursor-pointer items-center gap-3 text-[0.95rem] text-ink-2 transition-colors hover:text-ink peer-checked:text-ink peer-checked:[&>span]:bg-ink peer-checked:[&>span]:shadow-[inset_0_0_0_3px_var(--paper)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >
        <span aria-hidden="true" className={clsx("size-4 shrink-0 border border-ink/60", type === "radio" && "rounded-full")} />
        {label}
      </label>
    </li>
  );
}

function Group({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="border-t border-line py-1">
      <summary className="flex min-h-12 items-center justify-between">
        <span className="t-label">{title}</span>
        <IconChevron size={18} className="chev" />
      </summary>
      <fieldset className="pb-4">
        <legend className="sr-only">{title}</legend>
        {children}
      </fieldset>
    </details>
  );
}

/** Formulário GET de filtros: funciona sem JS; com JS, aplica a cada mudança. */
export function FilterForm({ basePath, filters: f, facets, idPrefix, defaultSort }: { basePath: string; filters: ListingFilters; facets: FacetConfig; idPrefix: string; defaultSort: ProductSort }) {
  return (
    <Form action={basePath} scroll={false} className="text-ink">
      <AutoSubmit />
      {f.ordem !== defaultSort ? <input type="hidden" name="ordem" value={f.ordem} /> : null}

      {facets.categories ? (
        <Group title="Categoria">
          <ul>
            <Option type="radio" name="categoria" value="" checked={!f.categoria} label="Todas" id={`${idPrefix}-cat-todas`} />
            {facets.categories.map((c) => (
              <Option key={c.slug} type="radio" name="categoria" value={c.slug} checked={f.categoria === c.slug} label={c.name} id={`${idPrefix}-cat-${c.slug}`} />
            ))}
          </ul>
        </Group>
      ) : null}

      {facets.collection ? (
        <Group title="Coleção">
          <ul>
            <Option type="radio" name="colecao" value="" checked={!f.colecao} label="Todas" id={`${idPrefix}-col-todas`} />
            {COLLECTIONS.map((c) => (
              <Option key={c.slug} type="radio" name="colecao" value={c.slug} checked={f.colecao === c.slug} label={c.name} id={`${idPrefix}-col-${c.slug}`} />
            ))}
          </ul>
        </Group>
      ) : null}

      {facets.gender ? (
        <Group title="Para quem">
          <ul>
            <Option type="radio" name="genero" value="" checked={!f.genero} label="Todos" id={`${idPrefix}-gen-todos`} />
            <Option type="radio" name="genero" value="feminino" checked={f.genero === "feminino"} label="Feminino" id={`${idPrefix}-gen-f`} />
            <Option type="radio" name="genero" value="masculino" checked={f.genero === "masculino"} label="Masculino" id={`${idPrefix}-gen-m`} />
          </ul>
        </Group>
      ) : null}

      {facets.sizes.length > 1 ? (
        <Group title="Tamanho">
          <ul className="grid grid-cols-4 gap-1.5">
            {facets.sizes.map((s) => {
              const id = `${idPrefix}-tam-${s}`;
              return (
                <li key={s}>
                  <input type="checkbox" name="tamanho" value={s} id={id} defaultChecked={f.tamanho.includes(s)} className="peer sr-only" />
                  <label
                    htmlFor={id}
                    className="tabular grid min-h-11 cursor-pointer place-items-center border border-line text-sm transition-colors hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                  >
                    {s}
                  </label>
                </li>
              );
            })}
          </ul>
        </Group>
      ) : null}

      <Group title="Preço">
        <ul>
          <Option type="radio" name="preco" value="" checked={!f.preco} label="Qualquer preço" id={`${idPrefix}-preco-todos`} />
          {PRICE_RANGES.map((p) => (
            <Option key={p.value} type="radio" name="preco" value={p.value} checked={f.preco === p.value} label={p.label} id={`${idPrefix}-preco-${p.value}`} />
          ))}
        </ul>
      </Group>

      <button type="submit" className="apply-btn btn btn-solid mt-4 w-full">
        Aplicar filtros
      </button>
    </Form>
  );
}

/** Ordenação no topo da grade; preserva os filtros ativos. */
export function SortForm({ basePath, filters: f, facets, idPrefix }: { basePath: string; filters: ListingFilters; facets: FacetConfig; idPrefix: string }) {
  return (
    <Form action={basePath} scroll={false} className="flex items-center gap-2">
      <AutoSubmit />
      {facets.categories && f.categoria ? <input type="hidden" name="categoria" value={f.categoria} /> : null}
      {facets.gender && f.genero ? <input type="hidden" name="genero" value={f.genero} /> : null}
      {facets.collection && f.colecao ? <input type="hidden" name="colecao" value={f.colecao} /> : null}
      {f.preco ? <input type="hidden" name="preco" value={f.preco} /> : null}
      {f.tamanho.map((s) => (
        <input key={s} type="hidden" name="tamanho" value={s} />
      ))}
      <label htmlFor={`${idPrefix}-ordem`} className="t-label whitespace-nowrap text-mute">
        Ordenar
      </label>
      <select id={`${idPrefix}-ordem`} name="ordem" defaultValue={f.ordem} className="field min-h-11 w-auto border-line py-2 text-sm">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="submit" className="apply-btn btn min-h-11 px-4">
        Ok
      </button>
    </Form>
  );
}
