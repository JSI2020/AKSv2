import localFont from "next/font/local";

/** High-contrast display serif — Melodrama (Fontshare) */
export const fontDisplay = localFont({
  src: "../app/fonts/Melodrama-Variable.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

/** Neutral UI grotesk — Switzer (Fontshare) */
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

/** Urdu UI — Noto Naskh Arabic (never Nastaliq for dense UI) */
export const fontUrdu = localFont({
  src: "../app/fonts/NotoNaskhArabic-Variable.ttf",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});
