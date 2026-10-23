"use client";

import { useEffect } from "react";
import type { CartView } from "@/lib/types";
import { useStore } from "./StoreProvider";

/** Alinha a sacola do cliente com a do servidor (o layout não re-renderiza após o redirect do checkout). */
export function CartSync({ cart }: { cart: CartView }) {
  const { syncCart } = useStore();
  useEffect(() => {
    syncCart(cart);
  }, [cart, syncCart]);
  return null;
}
