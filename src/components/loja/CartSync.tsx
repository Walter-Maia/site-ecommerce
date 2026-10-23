"use client";

import { useEffect } from "react";
import { STATIC_DEMO } from "@/lib/static-demo";
import type { CartView } from "@/lib/types";
import { readCartView } from "@/static/client/storage";
import { useStore } from "./StoreProvider";

/** Alinha a sacola do cliente com a do servidor (o layout não re-renderiza após o redirect do checkout). */
export function CartSync({ cart }: { cart: CartView }) {
  const { syncCart } = useStore();
  useEffect(() => {
    // Demo estática: a sacola "do servidor" é a do build (vazia); a real está no localStorage.
    syncCart(STATIC_DEMO ? readCartView() : cart);
  }, [cart, syncCart]);
  return null;
}
