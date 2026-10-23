import type { Metadata, Viewport } from "next";
import { Archivo, Newsreader, Press_Start_2P, VT323 } from "next/font/google";
import { SITE } from "@/data/site";
import { openGraph } from "@/lib/seo/metadata";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
// Fontes do provador (Y2K): sem preload — só baixam nas páginas que as usam, não em toda a loja.
const pixel = Press_Start_2P({ variable: "--font-pixel", weight: "400", subsets: ["latin"], display: "swap", preload: false });
const lcd = VT323({ variable: "--font-lcd", weight: "400", subsets: ["latin"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}® — ${SITE.tagline}`, template: `%s | ${SITE.name}®` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: openGraph(),
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${newsreader.variable} ${pixel.variable} ${lcd.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
