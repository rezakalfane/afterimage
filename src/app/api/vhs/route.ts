// Poll the VHS tape. Returns { status, url } — url is set once the video is ready (time-limited).
import { NextResponse } from "next/server";
import { playerId } from "@/lib/player";
import { pollVhs } from "@/lib/vhs";
import { loadWorld, store } from "@/lib/world/store";

export async function GET() {
  const world = await loadWorld(await playerId());
  if (!world.found.includes("cassette")) return NextResponse.json({ status: "not_found", url: null });
  try {
    const { state, url } = await pollVhs(world);
    await store.set(state);
    return NextResponse.json({ status: state.vhs.status, url, message: state.message });
  } catch (e) {
    console.error("[vhs]", e);
    return NextResponse.json({ status: world.vhs.status, url: null, message: world.message });
  }
}
