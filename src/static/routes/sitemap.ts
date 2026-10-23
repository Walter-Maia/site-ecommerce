/**
 * Demo estática: o sitemap original (force-dynamic no servidor) gerado uma vez
 * no build. Os caminhos já saem absolutos e com /site-ecommerce (absoluteUrl).
 */
export { default } from "@/app/sitemap";

export const dynamic = "force-static";
