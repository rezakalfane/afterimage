import type { Metadata } from "next";
import { DEFAULT_LOCALE, WORLD, tr } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  title: `${WORLD.title} — ${tr(WORLD.subtitle, DEFAULT_LOCALE)}`,
  description: "AFTERIMAGE: an interactive two-era mystery powered by the Napster API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // <html lang> is updated client-side from the [locale] segment.
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>{children}</body>
    </html>
  );
}
