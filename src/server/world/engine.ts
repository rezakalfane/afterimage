import "server-only";
// Deterministic world engine (pure: no DB, network, clock or randomness).
// Ported from docs/kit/world-engine.mjs to strict TypeScript. Differences are listed in
// docs/DECISIONS.md ("Engine changes vs kit"). The CALLER builds `ctx` from trusted server
// state (session, lease); it is never read from a request body.
import { ENDING_IDS, EPISODE, type CharacterId, type EndingId, type Era } from "./content";
import { parseSeat } from "./seat";

/** Kit flags + "future_key_found" (2026 key search split from opening the cabinet) + door states:
 *  "door_closed_<era>" = the player closed the cabinet again after it was opened (freedom, no
 *  canon change: opening it again only reopens the door; prerequisites are untouched). */
export type Flag =
  | (typeof EPISODE.requiredFlags)[number]
  | "future_key_found"
  | "door_closed_1996"
  | "door_closed_2026"
  /** The player presented the 2008 report to Jeanne (a future document: a temporal claim). */
  | "report_shared"
  /** The player explicitly claimed to come from 2026 (backed by their own words or the UI). */
  | "temporal_claim";
export type Phase = "investigate" | "preserve" | "recover" | "decide" | "finished";
export type HintTopic = "key" | "cache" | "promise";
export type StorageLocation = "upper_cabinet" | "lower_cabinet" | "desk" | "drawer" | "floor";

export interface WorldState {
  schemaVersion: 1;
  revision: number;
  activeEra: Era;
  phase: Phase;
  flags: Flag[];
  messageDraft: string | null;
  message: string | null;
  storage: StorageLocation | null;
  ending: EndingId | null;
  hintsUsed: number;
  hintLevels: Record<HintTopic, number>;
  /** Seat the player proposed to Jeanne, once accepted (canonical form). */
  proposedSeat?: string | null;
  /** Last hint requested: progression restarts gently when the player reaches a new step. */
  hintCursor?: { topic: HintTopic; step: string; level: number } | null;
}

export type Channel = "ui" | "tool" | "ending-confirmed";
export interface EngineContext {
  channel: Channel;
  /** Character of the live conversation that proposed the action (tool channel only). */
  character?: CharacterId;
}

export type Action =
  | "inspect_photo"
  | "share_photo_note"
  | "ask_usual_place"
  | "propose_seat"
  | "share_report"
  | "claim_future"
  | "retrieve_key"
  | "open_cabinet"
  | "inspect_programme"
  | "read_letter"
  | "acknowledge_permission"
  | "inspect_waterline"
  | "relay_flood_warning"
  | "write_message"
  | "confirm_message"
  | "preserve_cache"
  | "find_future_key"
  | "recover_cache"
  | "close_cabinet"
  | "look_at"
  | "read_message"
  | "read_future_letter"
  | "choose_ending"
  | "switch_era"
  | "request_hint";

export const ACTIONS: readonly Action[] = [
  "inspect_photo", "share_photo_note", "ask_usual_place", "propose_seat", "share_report", "claim_future", "retrieve_key", "open_cabinet", "inspect_programme", "read_letter",
  "acknowledge_permission", "inspect_waterline", "relay_flood_warning", "write_message", "confirm_message",
  "preserve_cache", "find_future_key", "recover_cache", "close_cabinet", "look_at", "read_message", "read_future_letter", "choose_ending", "switch_era", "request_hint",
];

export type FailCode =
  | "INVALID_ARGUMENT"
  | "UNKNOWN_ACTION"
  | "RUN_FINISHED"
  | "UNTRUSTED_CHANNEL"
  | "WRONG_CHARACTER"
  | "UI_CONFIRMATION_REQUIRED"
  | "WRONG_ERA"
  | "PREREQUISITE_MISSING"
  | "MESSAGE_LOCKED"
  | "WRONG_LOCATION";

export type Command = { action: string; args?: Record<string, unknown> };
export type EngineEvent = { type: Action; revision: number; hint?: { topic: HintTopic; level: number } };
export type TransitionResult =
  | { ok: true; changed: false; state: WorldState }
  | { ok: true; changed: true; state: WorldState; event: EngineEvent }
  | { ok: false; code: FailCode; state: WorldState; detail?: string };

export const MESSAGE_MAX = 240;

export function initialState(): WorldState {
  return {
    schemaVersion: 1,
    revision: 0,
    activeEra: 2026,
    phase: "investigate",
    flags: [],
    messageDraft: null,
    message: null,
    storage: null,
    ending: null,
    hintsUsed: 0,
    hintLevels: { key: 0, cache: 0, promise: 0 },
    proposedSeat: null,
    hintCursor: null,
  };
}

/** [era, required flags, flag set] for the simple no-argument actions. */
const SIMPLE: Partial<Record<Action, [Era, Flag[], Flag]>> = {
  inspect_photo: [2026, [], "photo_seen"],
  share_photo_note: [1996, ["photo_seen"], "note_shared"],
  ask_usual_place: [1996, ["note_shared"], "row_learned"],
  retrieve_key: [1996, ["seat_proposed"], "key_found"],
  claim_future: [1996, [], "temporal_claim"],
  open_cabinet: [1996, ["key_found"], "cabinet_open"],
  inspect_programme: [1996, [], "programme_seen"],
  read_letter: [1996, ["cabinet_open", "programme_seen"], "letter_read"],
  acknowledge_permission: [1996, ["letter_read"], "permission_acknowledged"],
  inspect_waterline: [2026, [], "waterline_seen"],
  relay_flood_warning: [1996, ["waterline_seen"], "flood_warning_shared"],
  find_future_key: [2026, ["cache_preserved"], "future_key_found"],
  recover_cache: [2026, ["future_key_found"], "cache_recovered"],
  read_message: [2026, ["cache_recovered"], "message_read"],
  read_future_letter: [2026, ["cache_recovered"], "future_letter_read"],
};

/** What a character can show the player in each era (look_at targets; no secret, only places). */
export const LOOK_TARGETS: Record<Era, readonly string[]> = {
  1996: ["hall", "cabinet", "desk", "programme", "letter", "projector", "reels", "lamp", "splicer"],
  2026: ["cabinet", "projector", "desk", "photo", "waterline", "message", "letter", "reels", "lamp", "seats"],
};

/** Actions on what is inside the cabinet: refused while its door is closed. */
const DOOR_NEEDED: ReadonlySet<Action> = new Set(["read_letter", "read_message", "read_future_letter"]);

/** Actions that only the player's own UI can perform (never a model tool). */
const UI_ONLY: ReadonlySet<Action> = new Set(["switch_era", "confirm_message"]);
const STORAGE_LOCATIONS: readonly StorageLocation[] = ["upper_cabinet", "lower_cabinet", "desk", "drawer", "floor"];
/** The seat that matches Alice's place (row G + "place 7"). Server-only. */
const ALICE_SEAT = "G7";

// Disallowed control characters (keeps \t \n \r). Checked after NFC + trim.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/u;

/** Normalize a personal message the way the engine stores it. Returns null if invalid. */
export function normalizeMessage(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const t = text.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  const len = Array.from(t).length;
  if (len < 1 || len > MESSAGE_MAX || CONTROL.test(t)) return null;
  return t;
}

export function hintTopic(s: WorldState): HintTopic {
  const has = (f: Flag) => s.flags.includes(f);
  if (!has("cabinet_open")) return "key";
  if (!has("letter_read") || !has("permission_acknowledged")) return "promise";
  if (!has("cache_preserved")) return "cache";
  return "promise";
}

/** Which step of a topic the player is on (hints follow the current state, never a fixed list). */
export function hintStep(s: WorldState, topic: HintTopic): string {
  const has = (f: Flag) => s.flags.includes(f);
  if (topic === "key") {
    if (!has("photo_seen")) return "photo";
    if (!has("note_shared")) return "note";
    if (!has("row_learned")) return "row";
    if (!has("programme_seen")) return "programme";
    if (!has("seat_proposed")) return "seat";
    if (!has("key_found")) return "search";
    return "open";
  }
  if (topic === "cache") {
    if (!has("waterline_seen")) return "trace";
    if (!has("flood_warning_shared")) return "risk";
    if (!has("message_confirmed")) return "words";
    return "place";
  }
  if (!has("letter_read")) return "letter";
  if (!has("permission_acknowledged")) return "consent";
  return "choice";
}

function phaseOf(s: WorldState): Phase {
  const has = (f: Flag) => s.flags.includes(f);
  return s.ending ? "finished" : has("cache_recovered") ? "decide" : has("cache_preserved") ? "recover" : has("cabinet_open") ? "preserve" : "investigate";
}

export function transition(state: WorldState, command: Command, ctx: EngineContext): TransitionResult {
  const fail = (code: FailCode, detail?: string): TransitionResult => ({ ok: false, code, state, detail });
  if (!command || typeof command !== "object" || Array.isArray(command)) return fail("INVALID_ARGUMENT");
  if (Object.keys(command).some((k) => k !== "action" && k !== "args")) return fail("INVALID_ARGUMENT");
  const { action } = command;
  const args = command.args ?? {};
  if (typeof action !== "string" || !args || typeof args !== "object" || Array.isArray(args)) return fail("INVALID_ARGUMENT");
  if (!(ACTIONS as readonly string[]).includes(action)) return fail("UNKNOWN_ACTION");
  const a = action as Action;
  if (state.ending) return fail("RUN_FINISHED");
  if (!ctx || !["ui", "tool", "ending-confirmed"].includes(ctx.channel)) return fail("UNTRUSTED_CHANNEL");
  if (ctx.channel === "tool") {
    const expected: CharacterId = state.activeEra === 1996 ? "jeanne" : "malik";
    if (ctx.character !== expected) return fail("WRONG_CHARACTER");
    if (UI_ONLY.has(a) || a === "choose_ending") return fail("UI_CONFIRMATION_REQUIRED");
  }
  if (a === "choose_ending" && ctx.channel !== "ending-confirmed") return fail("UI_CONFIRMATION_REQUIRED");
  if (a !== "choose_ending" && ctx.channel === "ending-confirmed") return fail("UNTRUSTED_CHANNEL");

  const s: WorldState = structuredClone(state);
  const has = (f: Flag) => s.flags.includes(f);
  const need = (fs: Flag[]) => fs.every(has);
  const mark = (f: Flag) => {
    if (!has(f)) s.flags.push(f);
  };
  const exact = (keys: string[]) => Object.keys(args).every((k) => keys.includes(k)) && keys.every((k) => Object.hasOwn(args, k));
  let hint: EngineEvent["hint"];

  const simple = SIMPLE[a];
  if (simple) {
    if (!exact([])) return fail("INVALID_ARGUMENT");
    const [era, required, flag] = simple;
    if (s.activeEra !== era) return fail("WRONG_ERA");
    if (!need(required)) return fail("PREREQUISITE_MISSING");
    // After storing, Jeanne locked the cabinet and hid the key behind the projector: it stays shut in 1996.
    if (a === "open_cabinet" && has("cache_preserved")) return fail("PREREQUISITE_MISSING", "sealed");
    // Reading what is inside needs the door open (the player may have closed it again).
    if (DOOR_NEEDED.has(a) && has(`door_closed_${era}`)) return fail("PREREQUISITE_MISSING", "door");
    mark(flag);
    // Opening an already unlocked cabinet just reopens its door.
    if (a === "open_cabinet" || a === "recover_cache") s.flags = s.flags.filter((f) => f !== `door_closed_${era}`);
  } else if (a === "propose_seat") {
    if (!exact(["seat"])) return fail("INVALID_ARGUMENT");
    if (s.activeEra !== 1996) return fail("WRONG_ERA");
    if (has("seat_proposed")) return { ok: true, changed: false, state };
    const seat = parseSeat(args.seat);
    if (!seat) return fail("INVALID_ARGUMENT", "seat");
    // A guess before the clues are gathered is never called wrong: ask what leads there.
    if (!need(["row_learned", "programme_seen"])) return fail("PREREQUISITE_MISSING", "why");
    if (seat !== ALICE_SEAT) return fail("PREREQUISITE_MISSING", "seat_mismatch");
    s.proposedSeat = seat;
    mark("seat_proposed");
  } else if (a === "share_report") {
    if (!exact([])) return fail("INVALID_ARGUMENT");
    if (s.activeEra !== 1996) return fail("WRONG_ERA");
    if (!need(["waterline_seen"])) return fail("PREREQUISITE_MISSING");
    // Presenting the 2008 report also conveys the water risk.
    mark("report_shared");
    mark("flood_warning_shared");
  } else if (a === "look_at") {
    // Pure look: shows a place or object of the CURRENT era to the player; never mutates.
    if (!exact(["target"]) || !LOOK_TARGETS[s.activeEra].includes(String(args.target))) return fail("INVALID_ARGUMENT");
    return { ok: true, changed: false, state };
  } else if (a === "close_cabinet") {
    if (!exact([])) return fail("INVALID_ARGUMENT");
    const era = s.activeEra;
    // 1996: only while it is open (after storing, Jeanne locked it and hid the key). 2026: once recovered.
    const open = era === 1996 ? has("cabinet_open") && !has("cache_preserved") : has("cache_recovered");
    if (!open) return fail("PREREQUISITE_MISSING");
    mark(`door_closed_${era}`);
  } else if (a === "switch_era") {
    if (!exact(["era"]) || (args.era !== 1996 && args.era !== 2026)) return fail("INVALID_ARGUMENT");
    s.activeEra = args.era as Era;
  } else if (a === "write_message") {
    if (!exact(["text"])) return fail("INVALID_ARGUMENT");
    if (s.activeEra !== 1996) return fail("WRONG_ERA");
    if (!need(["letter_read"])) return fail("PREREQUISITE_MISSING");
    if (has("cache_preserved")) return fail("MESSAGE_LOCKED");
    const text = normalizeMessage(args.text);
    if (text === null) return fail("INVALID_ARGUMENT", "message");
    if (s.messageDraft !== text) {
      s.messageDraft = text;
      s.message = null;
      s.flags = s.flags.filter((f) => f !== "message_confirmed");
    }
  } else if (a === "confirm_message") {
    if (!exact(["text"]) || !s.messageDraft || args.text !== s.messageDraft) return fail("INVALID_ARGUMENT");
    if (s.activeEra !== 1996) return fail("WRONG_ERA");
    if (has("cache_preserved")) return fail("MESSAGE_LOCKED");
    s.message = s.messageDraft;
    mark("message_confirmed");
  } else if (a === "preserve_cache") {
    if (!exact(["location"]) || !STORAGE_LOCATIONS.includes(args.location as StorageLocation)) return fail("INVALID_ARGUMENT");
    if (s.activeEra !== 1996) return fail("WRONG_ERA");
    if (has("cache_preserved")) return { ok: true, changed: false, state };
    if (!need(["cabinet_open", "permission_acknowledged", "flood_warning_shared", "message_confirmed"])) return fail("PREREQUISITE_MISSING");
    if (has("door_closed_1996")) return fail("PREREQUISITE_MISSING", "door");
    if (args.location !== "upper_cabinet") return fail("WRONG_LOCATION", String(args.location));
    s.storage = "upper_cabinet";
    mark("cache_preserved");
  } else if (a === "choose_ending") {
    if (!exact(["ending"]) || !ENDING_IDS.includes(args.ending as EndingId)) return fail("INVALID_ARGUMENT");
    if (s.activeEra !== 2026) return fail("WRONG_ERA");
    if (!need(["cache_recovered", "message_read", "future_letter_read"])) return fail("PREREQUISITE_MISSING");
    s.ending = args.ending as EndingId;
  } else if (a === "request_hint") {
    if (!exact([])) return fail("INVALID_ARGUMENT");
    const topic = hintTopic(s);
    const step = hintStep(s, topic);
    const prev = s.hintCursor;
    const level = prev && prev.topic === topic && prev.step === step ? Math.min(2, prev.level + 1) : 1;
    s.hintCursor = { topic, step, level };
    s.hintLevels[topic] = Math.min(3, s.hintLevels[topic] + 1);
    s.hintsUsed += 1;
    hint = { topic, level };
  }

  s.phase = phaseOf(s);
  if (JSON.stringify(s) === JSON.stringify(state)) return { ok: true, changed: false, state };
  s.revision += 1;
  return { ok: true, changed: true, state: s, event: { type: a, revision: s.revision, ...(hint ? { hint } : {}) } };
}

/** Default arguments used to probe availability (never applied as a real command). */
function probeArgs(a: Action, s: WorldState): Record<string, unknown> | null {
  switch (a) {
    case "switch_era":
      return { era: s.activeEra === 1996 ? 2026 : 1996 };
    case "write_message":
      return { text: s.messageDraft ?? "·" };
    case "confirm_message":
      return s.messageDraft ? { text: s.messageDraft } : null;
    case "preserve_cache":
      return { location: "upper_cabinet" };
    case "propose_seat":
      return { seat: ALICE_SEAT };
    case "choose_ending":
      return { ending: "public_cut" };
    default:
      return {};
  }
}

/** Actions that would succeed now on a given channel (computed by the engine, not hand-written). */
export function availableActions(s: WorldState, ctx: EngineContext): Action[] {
  const out: Action[] = [];
  for (const a of ACTIONS) {
    if (a === "request_hint") {
      if (!s.ending) out.push(a);
      continue;
    }
    const args = probeArgs(a, s);
    if (!args) continue;
    const probeCtx = a === "choose_ending" ? { channel: "ending-confirmed" as const } : ctx;
    if (a === "choose_ending" && ctx.channel !== "ui") continue;
    const r = transition(s, { action: a, args }, probeCtx);
    if (r.ok && (r.changed || a === "write_message")) out.push(a);
  }
  return out;
}
