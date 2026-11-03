import { fontData, fontDisplay, fontSans, fontUrdu } from "@/lib/fonts";
import { PostHogAnalyticsProvider } from "@/modules/analytics";
import { rootMetadata } from "@/modules/seo/metadata";
import "./globals.css";

export const metadata = rootMetadata();

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
