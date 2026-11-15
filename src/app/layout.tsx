import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import { cookies } from "next/headers";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LOCALE_COOKIE, pickLocale } from "@/i18n/messages";
import "./globals.css";

// Fonts are downloaded at build time and self-hosted by Next.js (no call to Google while playing).
// Both are under the SIL Open Font License 1.1 (see docs/LICENSES.md).
const display = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const body = Source_Sans_3({ subsets: ["latin", "latin-ext"], weight: ["400", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "AFTERIMAGE — La dernière séance",
  description: "Deux personnes. Le même cinéma. Trente ans d’écart.",
  robots: { index: false },
};
export const viewport: Viewport = { themeColor: "#101715", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale: only an ACTIVE locale from the cookie, else French (P0).
  const locale = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
