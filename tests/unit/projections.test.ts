import { describe, expect, it } from "vitest";
import { EPISODE } from "@/server/world/content";
import { initialState, transition } from "@/server/world/engine";
import { characterContext, playerView } from "@/server/world/projections";
import { connectionProfile, contextUpdateText } from "@/server/napster/context";
import { toolToCommand } from "@/server/napster/tools";
import { memoryId } from "@/server/security/ids";
import { ready } from "../support/ready";

const SECRETS = ["G7", "épilogue", "Alice — 14 novembre", "étagère haute", "derrière le projecteur", "2008"];

describe("player view", () => {
  it("initial state reveals no document, ending or clue", () => {
    const v = JSON.stringify(playerView(initialState()));
    for (const s of SECRETS) expect(v).not.toContain(s);
    expect(playerView(initialState()).notebook).toEqual([]);
  });
  it("documents appear only after their discovery", () => {
    const s = transition(initialState(), { action: "inspect_photo" }, { channel: "ui" }).state;
    const v = playerView(s);
    expect(v.notebook.map((n) => n.id)).toEqual(["photo"]);
    expect(JSON.stringify(v)).toContain("G7");
    expect(JSON.stringify(v)).not.toContain(EPISODE.documents.letter);
  });
  it("endings are offered only after both readings", () => {
    expect(playerView(ready()).endings).toHaveLength(3);
    const s = ready();
    expect(playerView({ ...s, flags: s.flags.filter((f) => f !== "future_letter_read") }).endings).toHaveLength(0);
  });
});

describe("character context", () => {
  it("Jeanne starts without G7, 2026 facts or the letter text", () => {
    const j = JSON.stringify(characterContext(initialState(), "jeanne", null));
    expect(j).not.toMatch(/G7|2008|Malik|2026/);
    expect(j).not.toContain(EPISODE.documents.letter);
  });
  it("Jeanne learns G7 only when relayed, never Malik's findings", () => {
    let s = initialState();
    s = transition(s, { action: "inspect_photo" }, { channel: "ui" }).state;
    s = transition(s, { action: "inspect_waterline" }, { channel: "ui" }).state;
    s = transition(s, { action: "switch_era", args: { era: 1996 } }, { channel: "ui" }).state;
    expect(JSON.stringify(characterContext(s, "jeanne", null))).not.toContain("G7");
    s = transition(s, { action: "relay_key_location" }, { channel: "ui" }).state;
    const j = characterContext(s, "jeanne", null);
    expect(JSON.stringify(j)).toContain("G7");
    expect(JSON.stringify(j)).not.toContain(EPISODE.documents.archiveReport);
  });
  it("Malik never gets the personal message or the letter before recovering them", () => {
    const s = ready("Canari-A");
    const before = { ...s, flags: s.flags.filter((f) => !["cache_recovered", "message_read", "future_letter_read"].includes(f)) };
    const m = JSON.stringify(characterContext(before, "malik", null));
    expect(m).not.toContain("Canari-A");
    expect(m).not.toContain(EPISODE.documents.letter);
    expect(JSON.stringify(characterContext(s, "malik", null))).toContain("Canari-A");
  });
  it("two runs produce disjoint contexts", () => {
    const a = JSON.stringify(characterContext(ready("phrase-A"), "malik", null));
    const b = JSON.stringify(characterContext(ready("phrase-B"), "malik", null));
    expect(a).not.toContain("phrase-B");
    expect(b).not.toContain("phrase-A");
  });
  it("connection profile stays small and lists tools, not internal action names", () => {
    const p = connectionProfile(characterContext(initialState(), "malik", null));
    expect(JSON.stringify(p).length).toBeLessThan(6000);
    expect(JSON.stringify(p)).toContain("malik_examine(objet=photo)");
    expect(contextUpdateText(characterContext(ready(), "malik", null)).length).toBeLessThanOrEqual(6000);
  });
});

describe("tools", () => {
  it("map to bounded commands; reject unknown tools, foreign characters and extra args", () => {
    expect(toolToCommand("malik", "malik_examine", { objet: "photo" })).toEqual({ ok: true, command: { action: "inspect_photo", args: {} } });
    expect(toolToCommand("jeanne", "jeanne_act", { geste: "conserver", emplacement: "bureau" })).toEqual({ ok: true, command: { action: "preserve_cache", args: { location: "desk" } } });
    expect(toolToCommand("malik", "jeanne_act", { geste: "ouvrir_armoire" })).toEqual({ ok: false });
    expect(toolToCommand("malik", "malik_examine", { objet: "photo", tenantId: "x" })).toEqual({ ok: false });
    expect(toolToCommand("malik", "choose_ending", { ending: "public_cut" })).toEqual({ ok: false });
    expect(toolToCommand("jeanne", "jeanne_act", { geste: "conserver" })).toEqual({ ok: false });
  });
});

describe("English tools (en agents)", () => {
  it("map to the same bounded commands; English values only", () => {
    expect(toolToCommand("malik", "en_malik_examine", { object: "photo" })).toEqual({ ok: true, command: { action: "inspect_photo", args: {} } });
    expect(toolToCommand("jeanne", "en_jeanne_act", { gesture: "store", location: "upper_shelf" })).toEqual({ ok: true, command: { action: "preserve_cache", args: { location: "upper_cabinet" } } });
    expect(toolToCommand("jeanne", "en_jeanne_draft_message", { text: "Stars stay lit." })).toEqual({ ok: true, command: { action: "write_message", args: { text: "Stars stay lit." } } });
    expect(toolToCommand("malik", "en_malik_examine", { object: "trace_eau" })).toEqual({ ok: false }); // French value on English tool
    expect(toolToCommand("malik", "en_malik_examine", { objet: "photo" })).toEqual({ ok: false }); // French key
    expect(toolToCommand("malik", "en_jeanne_act", { gesture: "open_cabinet" })).toEqual({ ok: false }); // other character
    expect(toolToCommand("malik", "en_world_request_hint", {})).toEqual({ ok: true, command: { action: "request_hint", args: {} } });
  });
});

describe("memory identity", () => {
  const base = { env: "local", tenantId: "t1", userId: "u1", runId: "r1", character: "malik", generation: 1 };
  it("is ≤ 32 chars, Napster-safe, stable and different per run/character/env", () => {
    const id = memoryId("s".repeat(32), base);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(id).toHaveLength(31);
    expect(memoryId("s".repeat(32), base)).toBe(id);
    for (const k of ["env", "tenantId", "userId", "runId", "character"] as const) expect(memoryId("s".repeat(32), { ...base, [k]: "other" })).not.toBe(id);
    expect(memoryId("s".repeat(32), { ...base, generation: 2 })).not.toBe(id);
  });
});
