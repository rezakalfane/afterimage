import "server-only";
// Per-run, per-character context sent to Napster. The agent's GLOBAL prompt never changes;
// run data travels only (a) as externalClientProfile when the connection is created and
// (b) as silent system messages sent by the player's own browser after each validated mutation.
import { CHARACTERS, type CharacterId } from "@/server/world/content";
import type { CharacterContext } from "@/server/world/projections";
import { texts, type Locale } from "@/server/world/texts";
import { toolsForActions } from "./tools";

const MAX_CONTEXT_CHARS = 6000;

export function connectionProfile(ctx: CharacterContext, locale: Locale = "fr") {
  return {
    afterimage: {
      ...ctx,
      availableActions: undefined,
      // Each locale lists its own tools (en agents: en_* names and English values).
      availableTools: toolsForActions(ctx.identity.characterId as CharacterId, ctx.availableActions, locale),
    },
  };
}

/** Text of the silent system update sent after a validated mutation (role: system, trigger_response: false). */
export function contextUpdateText(ctx: CharacterContext, locale: Locale = "fr"): string {
  const body = JSON.stringify(connectionProfile(ctx, locale).afterimage);
  const text = `${texts(locale).tool.contextHeader.replace("{revision}", String(ctx.revision))}\n${body}`;
  return text.length > MAX_CONTEXT_CHARS ? text.slice(0, MAX_CONTEXT_CHARS) : text;
}

/** Opening guidance (initialSpeech): the first line, once. */
export function openingInstruction(character: CharacterId, resumed: boolean, locale: Locale = "fr"): string {
  const t = texts(locale).tool;
  if (resumed) return t.resume;
  const line = locale === "en" ? t.openingLines[character] : CHARACTERS[character].opening;
  return t.opening.replace("{line}", line);
}
