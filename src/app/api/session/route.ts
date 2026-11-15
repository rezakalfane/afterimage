// Mint a WebRTC connection token for one character, in one locale, for the current player.
// The API key stays here; the browser only receives the short-lived token.
import { NextResponse } from "next/server";
import { CHARACTERS, isCharacterId, isLocale, tr } from "@/lib/content";
import { NapsterError, napster, type ConnectionResponse } from "@/lib/napster/api";
import { agentIdFor } from "@/lib/napster/ids";
import { playerId } from "@/lib/player";
import { loadWorld, store } from "@/lib/world/store";
import { factsFor } from "@/lib/world/world";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { character?: unknown; locale?: unknown };
  if (!isCharacterId(body.character) || !isLocale(body.locale)) {
    return NextResponse.json({ error: "invalid_character_or_locale" }, { status: 400 });
  }
  const character = CHARACTERS[body.character];
  const locale = body.locale;
  const agentId = agentIdFor(character.id, locale);
  if (!agentId) {
    return NextResponse.json({ error: "agent_not_provisioned", hint: "Run `npm run provision`." }, { status: 503 });
  }

  const pid = await playerId();
  const world = await loadWorld(pid);
  await store.set(world);

  try {
    const conn = await napster<ConnectionResponse>(`/public/agents/${agentId}/connections`, {
      method: "POST",
      body: {
        channelType: "webrtc",
        externalClientId: pid, // memory: the same player is remembered across sessions
        externalClientProfile: { faits_etablis: factsFor(character.id, world, locale), timeline: world.timeline },
        initialSpeech: tr(character.initialSpeech, locale),
        tags: { game: "afterimage", character: character.id, locale },
      },
    });
    return NextResponse.json({ token: conn.token, connectionId: conn.connection.id });
  } catch (e) {
    const status = e instanceof NapsterError ? e.status : 500;
    console.error("[session]", e);
    if (status === 409) return NextResponse.json({ error: "too_many_players" }, { status: 409 });
    if (status === 429) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    return NextResponse.json({ error: "session_failed" }, { status: 502 });
  }
}
