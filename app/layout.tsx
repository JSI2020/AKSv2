import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontData, fontDisplay, fontSans, fontUrdu } from "@/lib/fonts";
import { PostHogAnalyticsProvider } from "@/modules/analytics";
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
      <body className="font-sans antialiased">
        <PostHogAnalyticsProvider>{children}</PostHogAnalyticsProvider>
      </body>
    </html>
  );
}
