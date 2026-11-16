import "server-only";
// Player turns as PROOF of what the player shared (section "Ce que chaque personnage sait").
// The browser posts each final transcript / typed line of the player; the server computes the
// indicators itself and stores only a hash, booleans and a parsed seat/place — never the text.
// A character's tool call that records a player share must be backed by such a recent turn in
// the same live session; an autonomous model call cannot create the proof.
// Limit: this proves "the player's own client reported such a turn in this session", not a
// cryptographic truth (the client is the player's).
import { createHash } from "node:crypto";
import { sqlClient } from "@/server/db/client";
import type { TenantContext } from "@/server/dal/context";
import { parseLocation } from "@/server/napster/tools";
import { parseSeat } from "./seat";
import type { Action } from "./engine";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface TurnIndicators {
  note: boolean;
  water: boolean;
  report: boolean;
  future: boolean;
  seat: string | null;
  location: string | null;
}

export function classifyTurn(text: string): TurnIndicators {
  const t = norm(text);
  return {
    note: /\b(note|photo|verso|inscription|ecrit|back of|written)\b|place habituelle|notre place|usual place|our place/.test(t),
    water: /\b(eau|humid\w*|infiltr\w*|inond\w*|fuite|degats? des eaux|water|damp|flood\w*|leak\w*|wet)\b/.test(t),
    report: /\b(rapport|2016|report|conservation)\b/.test(t),
    future: /\b(2026|futur|avenir|trente ans|30 ans|autre epoque|une autre epoque|future|thirty years|another time|another era)\b/.test(t),
    seat: parseSeat(text),
    location: parseLocation(text),
  };
}

/** Record a player turn for an active lease of this caller (idempotent per item id). */
export async function recordTurn(ctx: TenantContext, runId: string, leaseId: string, itemId: string, text: string): Promise<boolean> {
  const lease = await sqlClient().execute({
    sql: `SELECT 1 FROM conversation_leases WHERE id = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active'`,
    args: [leaseId, ctx.tenantId, runId, ctx.userId],
  });
  if (!lease.rows[0]) return false;
  const i = classifyTurn(text);
  const hash = createHash("sha256").update(text.normalize("NFC")).digest("hex").slice(0, 32);
  await sqlClient().execute({
    sql: `INSERT OR IGNORE INTO player_turns (tenant_id, run_id, lease_id, item_id, at, text_hash, mentions_note, mentions_water, mentions_report, mentions_future, seat, location) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [ctx.tenantId, runId, leaseId, itemId, Date.now(), hash, +i.note, +i.water, +i.report, +i.future, i.seat, i.location],
  });
  return true;
}

/** Which indicator backs an action recorded from a character's tool, if any. */
export function backingFor(action: string, args: Record<string, unknown> | undefined): { column: string; value?: string } | null {
  switch (action as Action) {
    case "share_photo_note":
      return { column: "mentions_note" };
    case "relay_flood_warning":
      return { column: "mentions_water" };
    case "share_report":
      return { column: "mentions_report" };
    case "claim_future":
      return { column: "mentions_future" };
    case "propose_seat": {
      const seat = parseSeat(args?.seat);
      return seat ? { column: "seat", value: seat } : null;
    }
    case "preserve_cache":
      return typeof args?.location === "string" ? { column: "location", value: args.location } : null;
    default:
      return null;
  }
}

const WINDOW_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True when a recent turn of the player in this lease backs the share. Waits briefly for a
 *  transcript that may arrive just after the tool call. */
export async function isBacked(ctx: TenantContext, runId: string, leaseId: string, backing: { column: string; value?: string }, waitMs = 1500): Promise<boolean> {
  const allowed = new Set(["mentions_note", "mentions_water", "mentions_report", "mentions_future", "seat", "location"]);
  if (!allowed.has(backing.column)) return false;
  const cond = backing.value === undefined ? `${backing.column} = 1` : `${backing.column} = ?`;
  const deadline = Date.now() + waitMs;
  for (;;) {
    const r = await sqlClient().execute({
      sql: `SELECT 1 FROM player_turns WHERE tenant_id = ? AND run_id = ? AND lease_id = ? AND at >= ? AND ${cond} LIMIT 1`,
      args: [ctx.tenantId, runId, leaseId, Date.now() - WINDOW_MS, ...(backing.value === undefined ? [] : [backing.value])],
    });
    if (r.rows[0]) return true;
    if (Date.now() >= deadline) return false;
    await sleep(300);
  }
}

/** The seat the player named most recently in this session (parsed), if any. */
export async function latestSeat(ctx: TenantContext, runId: string, leaseId: string): Promise<string | null> {
  const r = await sqlClient().execute({
    sql: `SELECT seat FROM player_turns WHERE tenant_id = ? AND run_id = ? AND lease_id = ? AND at >= ? AND seat IS NOT NULL ORDER BY at DESC LIMIT 1`,
    args: [ctx.tenantId, runId, leaseId, Date.now() - WINDOW_MS],
  });
  return r.rows[0] ? String(r.rows[0].seat) : null;
}
