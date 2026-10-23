"use client";

import { createContext, use, useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { addToCart, removeCartLine, updateCartLine } from "@/server/actions/cart";
import { toggleWishlist } from "@/server/actions/wishlist";
import type { CartView, Size } from "@/lib/types";

type Panel = "cart" | "menu" | "search" | null;

interface StoreCtx {
  cart: CartView;
  cartPending: boolean;
  liked: ReadonlySet<string>;
  panel: Panel;
  openPanel: (p: Exclude<Panel, null>) => void;
  closePanel: () => void;
  add: (productId: string, size: Size, quantity?: number) => Promise<{ ok: boolean; error?: string }>;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  toggleLike: (productId: string) => void;
  /** Substitui a sacola por uma versão vinda do servidor (ex.: após o pedido). */
  syncCart: (cart: CartView) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function useStore() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useStore fora do StoreProvider");
  return ctx;
}

/** Evento para outras áreas (ex.: provador) sincronizarem a sacola do header. */
export const CART_EVENT = "quadra:cart-updated";

type CartOp = { type: "qty"; lineId: string; quantity: number } | { type: "remove"; lineId: string };

function applyOp(cart: CartView, op: CartOp): CartView {
  const lines =
    op.type === "remove"
      ? cart.lines.filter((l) => l.lineId !== op.lineId)
      : cart.lines.map((l) => (l.lineId === op.lineId ? { ...l, quantity: op.quantity, lineTotal: l.unitPrice * op.quantity } : l));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { ...cart, lines, subtotal, itemCount: lines.reduce((s, l) => s + l.quantity, 0), total: subtotal + cart.shipping };
}

export function StoreProvider({
  initialCart,
  initialLiked,
  children,
}: {
  initialCart: CartView;
  initialLiked: string[];
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [liked, setLiked] = useState<ReadonlySet<string>>(() => new Set(initialLiked));
  // Se o servidor re-renderizar o layout com dados novos, eles prevalecem.
  const [seenCart, setSeenCart] = useState(initialCart);
  if (seenCart !== initialCart) {
    setSeenCart(initialCart);
    setCart(initialCart);
  }
  const [seenLiked, setSeenLiked] = useState(initialLiked);
  if (seenLiked !== initialLiked) {
    setSeenLiked(initialLiked);
    setLiked(new Set(initialLiked));
  }

  const [panel, setPanel] = useState<Panel>(null);
  const [cartPending, startCart] = useTransition();
  const [optimisticCart, applyOptimistic] = useOptimistic(cart, applyOp);
  const [optimisticLiked, flipLiked] = useOptimistic(liked, (set: ReadonlySet<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const [, startLike] = useTransition();

  useEffect(() => {
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent<CartView | undefined>).detail;
      if (detail && Array.isArray(detail.lines)) setCart(detail);
    };
    window.addEventListener(CART_EVENT, onExternal);
    return () => window.removeEventListener(CART_EVENT, onExternal);
  }, []);

  const add = useCallback(async (productId: string, size: Size, quantity = 1) => {
    try {
      const res = await addToCart({ productId, size, quantity });
      if (!res.ok) return { ok: false, error: res.error };
      setCart(res.data);
      setPanel("cart");
      return { ok: true };
    } catch {
      return { ok: false, error: "Não foi possível adicionar agora. Tente de novo." };
    }
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    const q = Math.max(1, Math.min(10, quantity));
    startCart(async () => {
      applyOptimistic({ type: "qty", lineId, quantity: q });
      const res = await updateCartLine({ lineId, quantity: q }).catch(() => null);
      if (res?.ok) setCart(res.data);
    });
  }, [applyOptimistic]);

  const remove = useCallback((lineId: string) => {
    startCart(async () => {
      applyOptimistic({ type: "remove", lineId });
      const res = await removeCartLine({ lineId }).catch(() => null);
      if (res?.ok) setCart(res.data);
    });
  }, [applyOptimistic]);

  const toggleLike = useCallback((productId: string) => {
    startLike(async () => {
      flipLiked(productId);
      const res = await toggleWishlist({ productId }).catch(() => null);
      if (res?.ok) setLiked(new Set(res.data.productIds));
    });
  }, [flipLiked]);

  const value = useMemo<StoreCtx>(
    () => ({
      cart: optimisticCart,
      cartPending,
      liked: optimisticLiked,
      panel,
      openPanel: setPanel,
      closePanel: () => setPanel(null),
      add,
      setQuantity,
      remove,
      toggleLike,
      syncCart: setCart,
    }),
    [optimisticCart, cartPending, optimisticLiked, panel, add, setQuantity, remove, toggleLike],
  );

  return <Ctx value={value}>{children}</Ctx>;
}
