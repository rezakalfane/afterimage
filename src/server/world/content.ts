import "server-only";
// Server-side episode content (the bible). NEVER import from a client component:
// it contains future documents and private canon.
import { createHash } from "node:crypto";
import episodeJson from "@/content/episodes/last-screening/v1/episode.json";
import charactersJson from "@/content/episodes/last-screening/v1/characters.json";
import { PROMPTS } from "@/content/episodes/last-screening/v1/prompts";

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
export function documentText(key: DocumentKey): string {
  return EPISODE.documents[key];
}
