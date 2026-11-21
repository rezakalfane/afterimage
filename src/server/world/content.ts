import "server-only";
// Server-side episode content (the bible). NEVER import from a client component:
// it contains future documents and private canon.
import { createHash } from "node:crypto";
import episodeJson from "@/content/episodes/last-screening/v1/episode.json";
import charactersJson from "@/content/episodes/last-screening/v1/characters.json";
import { PROMPTS } from "@/content/episodes/last-screening/v1/prompts";
import { EN } from "@/content/episodes/last-screening/v1/i18n.en";

export type Era = 1996 | 2026;
export type CharacterId = "jeanne" | "malik";
export type EndingId = "public_cut" | "sealed_archive" | "broken_promise";

export const EPISODE = episodeJson;
export const CHARACTERS = charactersJson as Record<CharacterId, (typeof charactersJson)["jeanne"]>;
export const EPISODE_ID = EPISODE.id;
export const EPISODE_VERSION = EPISODE.version;
export const CANON_VERSION = `${EPISODE.id}@${EPISODE.version}`;
export const ENDING_IDS = EPISODE.endings.map((e) => e.id) as EndingId[];

/** Immutable global prompts of the shared agents (no player data, ever). */
export const SYSTEM_PROMPTS: Record<CharacterId, Record<string, string>> = PROMPTS;

export function characterForEra(era: Era): CharacterId {
  return era === 1996 ? "jeanne" : "malik";
}

export function contentHash(): string {
  return createHash("sha256").update(JSON.stringify({ e: EPISODE, c: CHARACTERS, p: SYSTEM_PROMPTS })).digest("hex");
}

export type DocumentKey = keyof typeof EPISODE.documents;
export type ContentLocale = "fr" | "en";

/** Episode documents in a locale (French is the reference). */
export function docs(locale: ContentLocale): Record<DocumentKey, string> {
  return locale === "en" ? { ...EPISODE.documents, ...EN.documents } : EPISODE.documents;
}
export function endings(locale: ContentLocale) {
  return EPISODE.endings.map((e) => (locale === "en" ? { ...e, ...EN.endings[e.id] } : e));
}
/** Character facts in a locale: initial facts, flag-triggered disclosures, opening line. */
export function characterFacts(character: CharacterId, locale: ContentLocale) {
  const c = CHARACTERS[character];
  // Extra disclosure (not in the kit data): the 2026 key search is split from opening the cabinet.
  const extra = character === "malik" ? [{ when: "future_key_found", fact: "Malik a trouvé une clé au croissant derrière le projecteur ; elle devrait ouvrir l’armoire." }] : [];
  if (locale !== "en") return { initialKnown: [...c.initialKnown], disclosures: [...c.disclosures.map((d) => ({ when: d.when, fact: d.fact })), ...extra], opening: c.opening, humour: c.humour };
  const e = EN.characters[character];
  return { initialKnown: [...e.initialKnown], disclosures: [...c.disclosures, ...extra].map((d) => ({ when: d.when, fact: e.disclosures[d.when] ?? d.fact })), opening: e.opening, humour: e.humour };
}
export function documentText(key: DocumentKey): string {
  return EPISODE.documents[key];
}
