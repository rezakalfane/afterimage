// Implicit tool calls are forwarded here by the browser. The canon guardian decides the outcome;
// the browser returns `output` to the agent with send_function_output and applies `events` to the UI.
import { after, NextResponse } from "next/server";
import { CHARACTERS, isCharacterId, isLocale, type ToolName } from "@/lib/content";
import { playerId } from "@/lib/player";
import { requestVhs } from "@/lib/vhs";
import { loadWorld, store } from "@/lib/world/store";
import { applyTool, viewOf } from "@/lib/world/world";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    character?: unknown;
    locale?: unknown;
    name?: unknown;
    args?: unknown;
  };
  if (!isCharacterId(body.character) || !isLocale(body.locale) || typeof body.name !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const character = CHARACTERS[body.character];
  if (!character.tools.includes(body.name as ToolName)) {
    return NextResponse.json({ output: { ok: false, error: "tool_not_available_for_character" }, events: [] });
  }
  const pid = await playerId();
  const args = body.args && typeof body.args === "object" ? (body.args as Record<string, unknown>) : {};
  const result = applyTool(await loadWorld(pid), character.id, body.name as ToolName, args, body.locale, Date.now());
  await store.set(result.state);

  // Start rendering the VHS tape now: the time the player spends before reaching 2026 hides the render.
  if (result.events.some((e) => e.type === "vhs_requested")) {
    after(async () => {
      const latest = await loadWorld(pid);
      await store.set(await requestVhs(latest));
    });
  }
  return NextResponse.json({ output: result.output, events: result.events, view: viewOf(result.state) });
}
