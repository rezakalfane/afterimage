import { notFound } from "next/navigation";
import { Game } from "@/components/Game";
import { LOCALE_CODES, isLocale } from "@/lib/content";

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Game locale={locale} />;
}
