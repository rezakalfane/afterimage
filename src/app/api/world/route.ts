// GET: the player's world view. DELETE: start a new game (new player id, so agent memory starts fresh).
import { NextResponse } from "next/server";
import { playerId } from "@/lib/player";
import { loadWorld, store } from "@/lib/world/store";
import { newWorld, viewOf } from "@/lib/world/world";

export async function GET() {
  const world = await loadWorld(await playerId());
  return NextResponse.json(viewOf(world));
}

export async function DELETE() {
  const world = newWorld(await playerId({ reset: true }));
  await store.set(world);
  return NextResponse.json(viewOf(world));
}
