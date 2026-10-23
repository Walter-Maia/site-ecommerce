/**
 * Verificação de CONTRATO em tempo de compilação (`npx tsc --noEmit`).
 *
 * No `npm run build:pages` os módulos `@/server/*` usados por páginas e
 * componentes são trocados pelas versões estáticas de src/static/server/**.
 * Este arquivo garante que cada versão estática exporta as MESMAS funções com
 * tipos compatíveis (argumentos e `ActionResult`/`FormState` de retorno), para
 * que os componentes existentes funcionem sem mudança. Não é importado em runtime.
 */
import type * as RealCatalog from "@/server/catalog";
import type * as RealMannequins from "@/server/mannequins";
import type * as RealSession from "@/server/session";
import type * as RealCart from "@/server/cart";
import type * as RealWishlist from "@/server/wishlist";
import type * as RealLooks from "@/server/looks";
import type * as RealOrders from "@/server/orders";
import type * as RealCartActions from "@/server/actions/cart";
import type * as RealWishlistActions from "@/server/actions/wishlist";
import type * as RealLooksActions from "@/server/actions/looks";
import type * as RealAuthActions from "@/server/actions/auth";
import type * as RealCheckoutActions from "@/server/actions/checkout";
import type * as RealNewsletterActions from "@/server/actions/newsletter";
import type * as StaticCatalog from "./server/catalog";
import type * as StaticMannequins from "./server/mannequins";
import type * as StaticSession from "./server/session";
import type * as StaticCart from "./server/cart";
import type * as StaticWishlist from "./server/wishlist";
import type * as StaticLooks from "./server/looks";
import type * as StaticOrders from "./server/orders";
import type * as StaticCartActions from "./server/actions/cart";
import type * as StaticWishlistActions from "./server/actions/wishlist";
import type * as StaticLooksActions from "./server/actions/looks";
import type * as StaticAuthActions from "./server/actions/auth";
import type * as StaticCheckoutActions from "./server/actions/checkout";
import type * as StaticNewsletterActions from "./server/actions/newsletter";

/** `S` precisa ter as chaves `K` de `R` com tipos atribuíveis. */
type Implements<R, S extends Pick<R, K>, K extends keyof R> = S;
/** Tipos iguais nos dois sentidos. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type ContractChecks = [
  Implements<typeof RealCatalog, typeof StaticCatalog, "listProducts" | "getProductBySlug" | "getProductsByIds" | "searchProducts" | "listCategories" | "getCategory" | "listCuratedLooks">,
  Implements<typeof RealMannequins, typeof StaticMannequins, "listMannequins" | "getMannequin">,
  Implements<typeof RealSession, typeof StaticSession, "getCurrentUser" | "requireUser" | "requireAdmin" | "getOwner" | "ownerColumn" | "safeNextPath">,
  Implements<typeof RealCart, typeof StaticCart, "getCart">,
  Implements<typeof RealWishlist, typeof StaticWishlist, "getWishlistProductIds">,
  Implements<typeof RealLooks, typeof StaticLooks, "listSavedLooks" | "getSavedLook">,
  Implements<typeof RealOrders, typeof StaticOrders, "getOrderForCurrentVisitor" | "listMyOrders" | "ORDER_STATUSES" | "isOrderId">,
  Implements<typeof RealCartActions, typeof StaticCartActions, "addToCart" | "updateCartLine" | "removeCartLine" | "addLookToCart">,
  Implements<typeof RealWishlistActions, typeof StaticWishlistActions, "toggleWishlist">,
  Implements<typeof RealLooksActions, typeof StaticLooksActions, "saveLook" | "deleteLook">,
  Implements<typeof RealAuthActions, typeof StaticAuthActions, "loginAction" | "registerAction" | "logoutAction">,
  Implements<typeof RealCheckoutActions, typeof StaticCheckoutActions, "placeOrderAction">,
  Implements<typeof RealNewsletterActions, typeof StaticNewsletterActions, "subscribeNewsletterAction">,
  Assert<Same<RealOrders.OrderView, StaticOrders.OrderView>>,
  Assert<Same<RealOrders.OrderSummary, StaticOrders.OrderSummary>>,
  Assert<Same<RealSession.Owner, StaticSession.Owner>>,
  Assert<Same<RealAuthActions.FormState, StaticAuthActions.FormState>>,
];
