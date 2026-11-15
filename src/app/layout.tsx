import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
