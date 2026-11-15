import "server-only";
// Locale of a request: the player's cookie, restricted to ACTIVE locales (fallback French).
import { LOCALE_COOKIE, pickLocale, type Locale } from "@/i18n/messages";

export function requestLocale(req: { headers: Headers }): Locale {
  const m = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([a-z]{2})`).exec(req.headers.get("cookie") ?? "");
  return pickLocale(m?.[1]);
}
