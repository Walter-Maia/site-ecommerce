import { MAX_INSTALLMENTS } from "@/data/site";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos → "R$ 189,90" */
export function formatPrice(cents: number): string {
  return brl.format(cents / 100);
}

/** "6x de R$ 31,65 sem juros" */
export function formatInstallments(cents: number, max = MAX_INSTALLMENTS): string {
  const n = Math.max(1, Math.min(max, Math.floor(cents / 3000) || 1));
  return `${n}x de ${formatPrice(Math.ceil(cents / n))} sem juros`;
}

export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}
