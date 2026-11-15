// Leak sweep (v3): random but deterministic walks through the engine, in many orders. For every
// state reached, what each character and the player can see must not contain a clue before the
// flag that legitimately reveals it. Covers the connection profile, the context update, the tools
// listed to the model ("outilsMaintenant"), the player view and every hint level, fr and en.
import { describe, expect, it } from "vitest";
import { availableActions, initialState, transition, type WorldState } from "@/server/world/engine";
import { characterContext, hintText, playerView } from "@/server/world/projections";
import { connectionProfile, contextUpdateText } from "@/server/napster/context";
import { toolsForActions } from "@/server/napster/tools";

const has = (s: WorldState, f: string) => s.flags.includes(f as never);

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const ACTIONS = [
  "inspect_photo", "inspect_waterline", "share_photo_note", "ask_usual_place", "inspect_programme", "propose_seat", "share_report", "claim_future",
  "retrieve_key", "open_cabinet", "close_cabinet", "read_letter", "acknowledge_permission", "relay_flood_warning", "write_message", "confirm_message",
  "preserve_cache", "find_future_key", "recover_cache", "read_message", "read_future_letter", "switch_era", "request_hint",
];
function argsFor(a: string, s: WorldState, r: () => number): Record<string, unknown> | undefined {
  if (a === "switch_era") return { era: s.activeEra === 1996 ? 2026 : 1996 };
  if (a === "write_message") return { text: "Mot-témoin" };
  if (a === "confirm_message") return { text: s.messageDraft ?? "" };
  if (a === "preserve_cache") return { location: ["upper_cabinet", "lower_cabinet", "desk", "drawer", "floor"][Math.floor(r() * 5)] };
  if (a === "propose_seat") return { seat: ["G7", "G sept", "G5", "rangée A, place 7"][Math.floor(r() * 4)] };
  return undefined;
}
function walks(n: number, steps: number): WorldState[] {
  const out: WorldState[] = [];
  for (let w = 0; w < n; w++) {
    const r = rng(w + 1);
    let s = initialState();
    out.push(s);
    for (let i = 0; i < steps; i++) {
      // Mostly an available action (to reach the late states), sometimes any action (refusals).
      const avail = availableActions(s, { channel: "ui" }).filter((x) => x !== "choose_ending" && x !== "request_hint");
      const a = avail.length && r() < 0.75 ? avail[Math.floor(r() * avail.length)] : ACTIONS[Math.floor(r() * ACTIONS.length)];
      const res = transition(s, { action: a, ...(argsFor(a, s, r) ? { args: argsFor(a, s, r) } : {}) }, { channel: "ui" });
      if (res.ok && res.changed) {
        s = res.state;
        out.push(s);
      }
    }
  }
  return out;
}

const STATES = walks(400, 60);

function jeanneSees(s: WorldState, locale: "fr" | "en") {
  const c = characterContext({ ...s, activeEra: 1996 }, "jeanne", null, locale);
  return [JSON.stringify(connectionProfile(c, locale)), contextUpdateText(c, locale), toolsForActions("jeanne", c.availableActions, locale).join(" ")].join("\n");
}
function malikSees(s: WorldState, locale: "fr" | "en") {
  const c = characterContext({ ...s, activeEra: 2026 }, "malik", null, locale);
  return [JSON.stringify(connectionProfile(c, locale)), contextUpdateText(c, locale)].join("\n");
}
function playerSees(s: WorldState, locale: "fr" | "en") {
  const hints: string[] = [];
  for (const level of [1, 2, 3]) for (const topic of ["key", "cache", "promise"] as const) hints.push(hintText({ ...s, hintLevels: { ...s.hintLevels, [topic]: level } }, locale) ?? "");
  return JSON.stringify(playerView(s, locale)) + "\n" + hints.join("\n");
}

describe("leak sweep over random walks", () => {
  it("covers the whole chapter (sanity: the walks reach storing and recovering)", () => {
    expect(STATES.some((s) => has(s, "seat_proposed"))).toBe(true);
    expect(STATES.some((s) => has(s, "cache_preserved"))).toBe(true);
    expect(STATES.some((s) => has(s, "temporal_claim") && !has(s, "report_shared"))).toBe(true);
    // Positive controls: the checks below can see these strings when they ARE legitimate.
    expect(STATES.some((s) => /\bG ?7\b/.test(jeanneSees(s, "fr")))).toBe(true);
    expect(STATES.some((s) => /rangée G/.test(jeanneSees(s, "fr")))).toBe(true);
    expect(STATES.some((s) => /place 7/.test(jeanneSees(s, "fr")))).toBe(true);
    expect(STATES.some((s) => /2026/.test(jeanneSees(s, "fr")))).toBe(true);
    expect(STATES.some((s) => /2008/.test(jeanneSees(s, "fr")))).toBe(true);
    expect(STATES.some((s) => /rangée G/.test(playerSees(s, "fr")))).toBe(true);
  });

  for (const locale of ["fr", "en"] as const) {
    it(`Jeanne (${locale}) learns nothing before it is shared`, () => {
      for (const s of STATES) {
        const j = jeanneSees(s, locale);
        if (!has(s, "seat_proposed")) expect(j, "G7").not.toMatch(/\bG ?7\b/);
        if (!has(s, "note_shared")) expect(j, "row").not.toMatch(/rangée G|row G/);
        if (!has(s, "programme_seen")) expect(j, "annotation").not.toMatch(/place 7|seat 7/);
        if (!has(s, "temporal_claim")) expect(j, "2026/Malik").not.toMatch(/2026|Malik/);
        if (!has(s, "report_shared")) expect(j, "2008").not.toMatch(/2008/);
        if (!has(s, "cache_preserved")) expect(j, "hiding place").not.toMatch(/étagère haute|upper shelf|haut de l’armoire|top of the cabinet/i);
      }
    });
    it(`Malik (${locale}) never gets Jeanne's clues`, () => {
      for (const s of STATES) {
        const m = malikSees(s, locale);
        expect(m).not.toMatch(/\bG ?7\b|rangée G|row G|place 7|seat 7/);
        if (!has(s, "cache_recovered")) expect(m).not.toMatch(/étagère haute|upper shelf/i);
        if (!has(s, "message_read")) expect(m).not.toContain("Mot-témoin");
      }
    });
    it(`player view and hints (${locale}) never spell the solutions`, () => {
      for (const s of STATES) {
        const p = playerSees(s, locale);
        expect(p, "G7").not.toMatch(/\bG ?7\b/);
        if (!has(s, "row_learned")) expect(p, "row").not.toMatch(/rangée G|row G/);
        if (!has(s, "programme_seen")) expect(p, "annotation").not.toMatch(/place 7|seat 7/);
        if (!has(s, "cache_preserved")) expect(p, "hiding place").not.toMatch(/étagère haute|upper shelf/i);
      }
    });
  }
});

import { texts } from "@/server/world/texts";
describe("hint dictionary", () => {
  it("no hint, at any level, spells a solution (fr, en)", () => {
    for (const locale of ["fr", "en"] as const) {
      const all = JSON.stringify(texts(locale).hints);
      expect(all).not.toMatch(/\bG ?7\b|rangée G|row G|place 7|seat 7|étagère haute|upper shelf/i);
    }
  });
});
