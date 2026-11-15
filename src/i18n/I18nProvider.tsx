"use client";
import { createContext, useContext } from "react";
import { messagesFor, type Locale, type Messages } from "./messages";

const Ctx = createContext<{ locale: Locale; t: Messages }>({ locale: "fr", t: messagesFor("fr") });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, t: messagesFor(locale) }}>{children}</Ctx.Provider>;
}

/** Interface strings for the active locale. */
export function useT(): Messages {
  return useContext(Ctx).t;
}
export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
