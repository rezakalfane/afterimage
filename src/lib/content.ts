// Typed access to the narrative content in /content. No user-facing text lives in src/.
import localesJson from "../../content/locales.json";
import worldJson from "../../content/world.json";
import jeanneJson from "../../content/characters/jeanne.json";
import malikJson from "../../content/characters/malik.json";

export type Locale = string;
/** A user-facing string with one entry per active locale. */
export type Localized = Record<Locale, string>;

export const DEFAULT_LOCALE: Locale = localesJson.default;
export const LOCALES: Record<Locale, { name: string; speak: string }> = localesJson.locales;
export const LOCALE_CODES: Locale[] = Object.keys(LOCALES);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in LOCALES;
}

/** Pick the string for `locale`, falling back to the default locale. */
export function tr(text: Localized, locale: Locale): string {
  return text[locale] ?? text[DEFAULT_LOCALE] ?? "";
}

export type Era = "1996" | "2026";
export const ERAS: Era[] = ["1996", "2026"];

export interface LocationDef {
  id: string;
  label: Localized;
  in1996: Localized;
  in2026: Localized;
}

export interface ItemDef {
  label: Localized;
  image: string;
}

export interface WorldDef {
  title: string;
  subtitle: Localized;
  cinema: string;
  eras: Record<Era, { scene: string; sceneTitle: Localized; objective: Localized }>;
  locations: LocationDef[];
  items: Record<string, ItemDef>;
  startingInventory: string[];
  vhs: { date: string; template: Localized };
  messageMaxChars: number;
}

export const WORLD: WorldDef = worldJson;

export type CharacterId = "jeanne" | "malik";
export type ToolName = "cacher_bobine" | "laisser_message" | "fouiller";

export interface CharacterDef {
  id: CharacterId;
  era: Era;
  firstName: string;
  lastName: string;
  headline: Localized;
  description: string;
  companion: { stockId: string | null; picture: string | null; gender: string; version: "v1" | "v2" };
  voiceId: string;
  temperature: number;
  promptFile: string;
  initialSpeech: Localized;
  tools: ToolName[];
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  jeanne: jeanneJson as CharacterDef,
  malik: malikJson as CharacterDef,
};

export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === "string" && value in CHARACTERS;
}

export function characterForEra(era: Era): CharacterDef {
  const c = Object.values(CHARACTERS).find((ch) => ch.era === era);
  if (!c) throw new Error(`No character for era ${era}`);
  return c;
}

export function location(id: string): LocationDef | undefined {
  return WORLD.locations.find((l) => l.id === id);
}

/**
 * Walk any JSON value and report localized objects (objects holding the default locale as a
 * string) that miss an active locale. Used by tests to keep the game fully multilingual.
 */
export function missingTranslations(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => missingTranslations(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  if (typeof obj[DEFAULT_LOCALE] === "string") {
    return LOCALE_CODES.filter((l) => typeof obj[l] !== "string" || !(obj[l] as string).trim()).map(
      (l) => `${path}.${l}`,
    );
  }
  return Object.entries(obj).flatMap(([k, v]) => missingTranslations(v, `${path}.${k}`));
}
