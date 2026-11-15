"use client";
// Language choice. Stores it in a cookie (read by the server) and reloads: the run state is
// language-free, so the game continues where it was; a live session closes on unload.
import { useLocale, useT } from "@/i18n/I18nProvider";
import { ACTIVE_LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/messages";

const NAMES: Record<Locale, string> = { fr: "Français", en: "English" };

export function setLocale(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

/** Compact FR | EN switch (game top bar). `onRequest` lets the game end a live call first. */
export function LanguageSwitch({ onRequest = setLocale }: { onRequest?: (l: Locale) => void }) {
  const locale = useLocale();
  const t = useT();
  if (ACTIVE_LOCALES.length < 2) return null;
  return (
    <nav className="lang-switch" aria-label={t.language.label}>
      {ACTIVE_LOCALES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === locale} title={NAMES[l]} onClick={() => l !== locale && onRequest(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}

/** Radio list (settings dialog). */
export function LanguageChoice({ onRequest = setLocale }: { onRequest?: (l: Locale) => void }) {
  const locale = useLocale();
  const t = useT();
  return (
    <fieldset className="choices">
      <legend>{t.language.label}</legend>
      {ACTIVE_LOCALES.map((l) => (
        <label key={l} className="choice" lang={l}>
          <input type="radio" name="locale" value={l} checked={l === locale} onChange={() => onRequest(l)} /> {NAMES[l]}
        </label>
      ))}
    </fieldset>
  );
}
