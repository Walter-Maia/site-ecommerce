import { AnnouncementBar } from "@/components/loja/AnnouncementBar";
import { CartDrawer } from "@/components/loja/CartDrawer";
import { Footer } from "@/components/loja/Footer";
import { Header } from "@/components/loja/Header";
import { editorial, imageExists } from "@/components/loja/media";
import { MenuOverlay } from "@/components/loja/MenuOverlay";
import { MotionRoot } from "@/components/loja/MotionRoot";
import { SearchOverlay } from "@/components/loja/SearchOverlay";
import { StoreProvider } from "@/components/loja/StoreProvider";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { getCart } from "@/server/cart";
import { listCategories } from "@/server/catalog";
import { getWishlistProductIds } from "@/server/wishlist";

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const [cart, liked, categories] = await Promise.all([getCart(), getWishlistProductIds(), listCategories()]);
  const menuImage = imageExists(editorial("grade-02")) ? editorial("grade-02") : null;

  return (
    <StoreProvider initialCart={cart} initialLiked={liked}>
      <div className="flex min-h-svh flex-col">
        <a
          href="#conteudo"
          className="sr-only-focusable fixed left-3 top-3 z-[60] bg-ink px-4 py-3 text-sm text-paper"
        >
          Pular para o conteúdo
        </a>
        <AnnouncementBar />
        <Header />
        {children}
        <Footer />
      </div>
      <MenuOverlay categories={categories} image={menuImage} />
      <SearchOverlay />
      <CartDrawer />
      <MotionRoot />
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
    </StoreProvider>
  );
}
