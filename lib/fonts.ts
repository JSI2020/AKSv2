import {
  Cormorant_Garamond,
  Jost,
  Noto_Nastaliq_Urdu,
} from "next/font/google";
import localFont from "next/font/local";

/** High-contrast display serif — Melodrama (Fontshare) — admin */
export const fontDisplay = localFont({
  src: "../app/fonts/Melodrama-Variable.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

/** Neutral UI grotesk — Switzer (Fontshare) — admin */
export const fontSans = localFont({
  src: "../app/fonts/Switzer-Variable.ttf",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

/** Numeric / data — Martian Mono */
export const fontData = localFont({
  src: "../app/fonts/MartianMono-Variable.ttf",
  variable: "--font-data",
  display: "swap",
  weight: "100 800",
});

/** Urdu UI — Noto Naskh Arabic (never Nastaliq for dense UI) — admin */
export const fontUrdu = localFont({
  src: "../app/fonts/NotoNaskhArabic-Variable.ttf",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});

/** Storefront display serif — Quiet Luxury prototype */
export const fontShopDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-shop-display",
  display: "swap",
});

/** Storefront body — Quiet Luxury prototype */
export const fontShopSans = Jost({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-shop-sans",
  display: "swap",
});

/** Storefront Urdu wordmark — Nastaliq (display only, not dense UI) */
export const fontShopUrdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400"],
  variable: "--font-shop-urdu",
  display: "swap",
});
