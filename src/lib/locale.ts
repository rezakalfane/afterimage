import { DEFAULT_LOCALE, LOCALE_CODES, type Locale } from "@/lib/content";

/** Best active locale for an Accept-Language header, else the default locale. */
export function pickLocale(acceptLanguage: string | null): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase().split("-")[0])
    .filter(Boolean);
  return wanted.find((l) => LOCALE_CODES.includes(l)) ?? DEFAULT_LOCALE;
}
