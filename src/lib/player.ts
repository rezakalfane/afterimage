// Anonymous player identity, kept in a cookie. It doubles as Napster's `externalClientId`,
// so the same player is remembered by Jeanne and Malik across sessions.
import { cookies } from "next/headers";

export const PLAYER_COOKIE = "afterimage_player";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/; // Napster's externalClientId format

export function newPlayerId(): string {
  return "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

/** Read the player id, creating and setting the cookie if missing. Route handlers only. */
export async function playerId(opts: { reset?: boolean } = {}): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(PLAYER_COOKIE)?.value;
  if (existing && ID_PATTERN.test(existing) && !opts.reset) return existing;
  const id = newPlayerId();
  jar.set(PLAYER_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return id;
}
