// The canon guardian: the single source of truth for what happened in 1996 and what exists in 2026.
// Pure functions only (no I/O, no clock): callers pass `now`, persist the returned state.
import { WORLD, location, tr, type CharacterId, type Era, type Locale, type ToolName } from "@/lib/content";

export type VhsStatus = "none" | "pending" | "ready" | "unavailable" | "failed";

export interface WorldState {
  playerId: string;
  /** Where Jeanne hid the reel in 1996 (a location id), or null. */
  reelHiddenIn: string | null;
  /** The exact message the player dictated to Jeanne, or null. */
  message: string | null;
  /** The locale the message was dictated in (the VHS tape is rendered in it). */
  messageLocale: Locale | null;
  vhs: { status: VhsStatus; recordingId: string | null };
  /** Item ids Malik has found in 2026 (in the current timeline). */
  found: string[];
  /** Location ids Malik has searched in the current timeline. */
  searched: string[];
  /** Bumped every time the past changes what exists in the present. */
  timeline: number;
  log: { at: number; who: CharacterId; what: string }[];
}

export type WorldEvent =
  | { type: "inventory"; items: string[] }
  | { type: "timeline_changed"; timeline: number }
  | { type: "vhs_requested" }
  | { type: "highlight"; locationId: string };

export interface ToolResult {
  state: WorldState;
  /** Returned to the agent as the tool output (plain object). */
  output: Record<string, unknown>;
  events: WorldEvent[];
}

export function newWorld(playerId: string): WorldState {
  return {
    playerId,
    reelHiddenIn: null,
    message: null,
    messageLocale: null,
    vhs: { status: "none", recordingId: null },
    found: [],
    searched: [],
    timeline: 0,
    log: [],
  };
}

function withLog(s: WorldState, who: CharacterId, what: string, now: number): WorldState {
  return { ...s, log: [...s.log, { at: now, who, what }].slice(-200) };
}

/** Items visible in the inventory for the era being played. */
export function inventory(s: WorldState, era: Era): string[] {
  const items = [...WORLD.startingInventory];
  if (era === "1996") {
    if (s.message) items.push("message");
    return items;
  }
  return [...items, ...s.found];
}

export function hideReel(s: WorldState, locationId: string, now: number): ToolResult {
  const loc = location(locationId);
  if (!loc) {
    return { state: s, events: [], output: { ok: false, error: "unknown_location", valid: WORLD.locations.map((l) => l.id) } };
  }
  const events: WorldEvent[] = [{ type: "highlight", locationId }];
  let next: WorldState = { ...s, reelHiddenIn: locationId };
  // Rewriting the past: what Malik found in another place no longer exists.
  if (s.reelHiddenIn !== locationId && (s.found.length > 0 || s.searched.length > 0)) {
    next = { ...next, found: [], searched: [], timeline: s.timeline + 1 };
    events.push({ type: "timeline_changed", timeline: next.timeline });
  }
  return { state: withLog(next, "jeanne", `hid reel in ${locationId}`, now), events, output: { ok: true, hidden_in: locationId } };
}

export function leaveMessage(s: WorldState, text: string, locale: Locale, now: number): ToolResult {
  const clean = text.trim().slice(0, WORLD.messageMaxChars);
  if (!clean) return { state: s, events: [], output: { ok: false, error: "empty_message" } };
  if (!s.reelHiddenIn) {
    return { state: s, events: [], output: { ok: false, error: "hide_reel_first", hint: "The message travels with the reel. Hide the reel first." } };
  }
  let next: WorldState = { ...s, message: clean, messageLocale: locale, vhs: { status: "pending", recordingId: null } };
  const events: WorldEvent[] = [{ type: "inventory", items: inventory(next, "1996") }, { type: "vhs_requested" }];
  if (s.found.length > 0) {
    next = { ...next, found: [], searched: [], timeline: s.timeline + 1 };
    events.push({ type: "timeline_changed", timeline: next.timeline });
  }
  return { state: withLog(next, "jeanne", `left message`, now), events, output: { ok: true, message: clean } };
}

export function search(s: WorldState, locationId: string, locale: Locale, now: number): ToolResult {
  const loc = location(locationId);
  if (!loc) {
    return { state: s, events: [], output: { ok: false, error: "unknown_location", valid: WORLD.locations.map((l) => l.id) } };
  }
  const searched = s.searched.includes(locationId) ? s.searched : [...s.searched, locationId];
  const output: Record<string, unknown> = { ok: true, place: tr(loc.label, locale), description: tr(loc.in2026, locale), found: [] as string[] };
  let found = s.found;
  if (s.reelHiddenIn === locationId) {
    const newly = ["bobine", ...(s.message ? ["message"] : []), ...(s.message && (s.vhs.status === "pending" || s.vhs.status === "ready") ? ["cassette"] : [])].filter(
      (id) => !found.includes(id),
    );
    found = [...found, ...newly];
    output.found = newly.map((id) => tr(WORLD.items[id].label, locale));
    if (s.message) output.message_text = s.message;
  }
  const next = withLog({ ...s, searched, found }, "malik", `searched ${locationId}`, now);
  const events: WorldEvent[] = [{ type: "highlight", locationId }];
  if (found.length !== s.found.length) events.push({ type: "inventory", items: inventory(next, "2026") });
  return { state: next, output, events };
}

export function applyTool(s: WorldState, character: CharacterId, name: ToolName, args: Record<string, unknown>, locale: Locale, now: number): ToolResult {
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
  if (character === "jeanne" && name === "cacher_bobine") return hideReel(s, str("lieu"), now);
  if (character === "jeanne" && name === "laisser_message") return leaveMessage(s, str("texte"), locale, now);
  if (character === "malik" && name === "fouiller") return search(s, str("lieu"), locale, now);
  return { state: s, events: [], output: { ok: false, error: "tool_not_available_for_character" } };
}

/**
 * What a character may know at session start, passed as `externalClientProfile.faits_etablis`.
 * Jeanne knows nothing of the future; Malik only knows what he has found in this timeline.
 */
export function factsFor(character: CharacterId, s: WorldState, locale: Locale): string[] {
  if (character === "jeanne") {
    const facts: string[] = [];
    if (s.reelHiddenIn) facts.push(`reel_hidden_in: ${tr(location(s.reelHiddenIn)!.label, locale)}`);
    if (s.message) facts.push(`message_left: "${s.message}"`);
    return facts;
  }
  const facts = s.searched.map((id) => `already_searched: ${tr(location(id)!.label, locale)}`);
  for (const id of s.found) facts.push(`found: ${tr(WORLD.items[id].label, locale)}`);
  if (s.found.includes("message") && s.message) facts.push(`message_text: "${s.message}"`);
  return facts;
}

/** Text the VHS recording speaks. Napster requires at least 84 characters. */
export function vhsScript(s: WorldState): string | null {
  if (!s.message) return null;
  const template = tr(WORLD.vhs.template, s.messageLocale ?? "");
  return template.replace("{message}", s.message);
}

/** Client-safe view of the world. */
export function viewOf(s: WorldState) {
  return {
    reelHidden: s.reelHiddenIn !== null,
    hasMessage: s.message !== null,
    message: s.found.includes("message") ? s.message : null,
    vhs: s.vhs.status,
    timeline: s.timeline,
    inventory: { "1996": inventory(s, "1996"), "2026": inventory(s, "2026") },
  };
}
export type WorldView = ReturnType<typeof viewOf>;
