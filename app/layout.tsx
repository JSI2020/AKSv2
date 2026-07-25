import type { Metadata } from "next";

import { fontData, fontDisplay, fontSans, fontUrdu } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "AKS",
  description: "AKS by Shahneela",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontData.variable} ${fontUrdu.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
