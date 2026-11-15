import idsJson from "@/generated/napster-ids.json";
import type { CharacterId, Locale } from "@/lib/content";

export interface NapsterIds {
  companions: Partial<Record<CharacterId, { id: string; source: string }>>;
  functions: Record<string, string>;
  agents: Partial<Record<CharacterId, Record<Locale, string>>>;
}

export const IDS = idsJson as unknown as NapsterIds;

export function agentIdFor(character: CharacterId, locale: Locale): string | null {
  return IDS.agents[character]?.[locale] ?? null;
}

export function companionIdFor(character: CharacterId): string | null {
  return IDS.companions[character]?.id ?? null;
}
