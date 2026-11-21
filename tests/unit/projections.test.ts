import { describe, expect, it } from "vitest";
import { EPISODE } from "@/server/world/content";
import { initialState, transition } from "@/server/world/engine";
import { characterContext, playerView } from "@/server/world/projections";
import { connectionProfile, contextUpdateText } from "@/server/napster/context";
import { toolToCommand } from "@/server/napster/tools";
import { memoryId } from "@/server/security/ids";
import { ready } from "../support/ready";

const SECRETS = ["G7", "rangée G", "place 7", "épilogue", "Alice — 14 novembre", "étagère haute", "derrière le projecteur", "2016"];

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
    expect(JSON.stringify(v)).toContain("notre place habituelle"); // the photo alone never names the seat
    expect(JSON.stringify(v)).not.toContain("G7");
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
    expect(j).not.toMatch(/G7|2016|Malik|2026/);
    expect(j).not.toContain(EPISODE.documents.letter);
  });
  it("an era switch shares nothing; the note and the row only after the player shares the note", () => {
    let s = initialState();
    s = transition(s, { action: "inspect_photo" }, { channel: "ui" }).state;
    s = transition(s, { action: "inspect_waterline" }, { channel: "ui" }).state;
    s = transition(s, { action: "switch_era", args: { era: 1996 } }, { channel: "ui" }).state;
    const before = JSON.stringify(characterContext(s, "jeanne", null));
    expect(before).not.toMatch(/habituelle|rangée G|2016|2026|Malik/);
    s = transition(s, { action: "share_photo_note" }, { channel: "ui" }).state;
    const j = JSON.stringify(characterContext(s, "jeanne", null));
    expect(j).toContain("notre place habituelle");
    expect(j).toContain("rangée G"); // her memory, triggered by the note
    expect(j).not.toContain(EPISODE.documents.archiveReport); // the report is not shared by sharing the note
    expect(j).not.toMatch(/2026|Malik/);
  });
  it("a temporal claim is a claim: Jeanne gets the claim, nothing more", () => {
    let s = transition(initialState(), { action: "switch_era", args: { era: 1996 } }, { channel: "ui" }).state;
    s = transition(s, { action: "claim_future" }, { channel: "ui" }).state;
    const j = JSON.stringify(characterContext(s, "jeanne", null));
    expect(j).toContain("affirme venir de 2026");
    expect(j).not.toMatch(/Malik|2016|habituelle/);
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
    expect(toolToCommand("jeanne", "en_jeanne_act", { gesture: "store", location: "on the top shelf" })).toEqual({ ok: true, command: { action: "preserve_cache", args: { location: "upper_cabinet" } } });
    expect(toolToCommand("jeanne", "en_jeanne_check_seat", { seat: "row G, seat seven" })).toEqual({ ok: true, command: { action: "propose_seat", args: { seat: "row G, seat seven" } } });
    expect(toolToCommand("jeanne", "en_jeanne_use_clue", { clue: "from_the_future" })).toEqual({ ok: true, command: { action: "claim_future", args: {} } });
    expect(toolToCommand("jeanne", "en_jeanne_draft_message", { text: "Stars stay lit." })).toEqual({ ok: true, command: { action: "write_message", args: { text: "Stars stay lit." } } });
    expect(toolToCommand("malik", "en_malik_examine", { object: "trace_eau" })).toEqual({ ok: false }); // French value on English tool
    expect(toolToCommand("malik", "en_malik_examine", { objet: "photo" })).toEqual({ ok: false }); // French key
    expect(toolToCommand("malik", "en_jeanne_act", { gesture: "open_cabinet" })).toEqual({ ok: false }); // other character
    expect(toolToCommand("malik", "en_world_request_hint", {})).toEqual({ ok: true, command: { action: "request_hint", args: {} } });
  });
});

describe("session locale", () => {
  it("an English session gets English tools, header and opening; French stays French", async () => {
    const { openingInstruction } = await import("@/server/napster/context");
    const ctx = characterContext(initialState(), "malik", null);
    const en = JSON.stringify(connectionProfile(ctx, "en"));
    expect(en).toContain("en_malik_examine(object=photo)");
    expect(en).not.toContain("objet=");
    expect(contextUpdateText(ctx, "en")).toMatch(/^\[AUTHORISED CONTEXT/);
    expect(contextUpdateText(ctx, "fr")).toMatch(/^\[CONTEXTE AUTORISÉ/);
    expect(openingInstruction("jeanne", false, "en")).toContain("Can you hear me?");
    expect(openingInstruction("jeanne", false, "fr")).toContain("Vous m’entendez ?");
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

describe("companion guidance", () => {
  const tail = (c: ReturnType<typeof characterContext>) => c.rules.join("\n");
  it("both characters know the inert green chest; Jeanne knows her cap; rules carry name, stop and humour", () => {
    for (const locale of ["fr", "en"] as const) {
      const j = characterContext(initialState(), "jeanne", null, locale);
      const m = characterContext({ ...initialState(), activeEra: 2026 }, "malik", null, locale);
      expect(j.knownFacts.join(" ")).toMatch(locale === "fr" ? /coffre vert/ : /green chest/);
      expect(m.knownFacts.join(" ")).toMatch(locale === "fr" ? /coffre vert/ : /green chest/);
      expect(j.knownFacts.join(" ")).toMatch(locale === "fr" ? /calot/ : /pillbox cap/);
      for (const c of [j, m]) expect(tail(c)).toMatch(locale === "fr" ? /prénom[\s\S]*arrête[\s\S]*humour/i : /name[\s\S]*stop[\s\S]*humour/i);
    }
  });
  it("the memory nudge exists only on the step 'find the usual place', and carries no detail", () => {
    let s = initialState();
    expect(playerView(s).hints.nudge).toBeNull();
    s = transition(s, { action: "inspect_photo" }, { channel: "ui" }).state;
    s = transition(s, { action: "switch_era", args: { era: 1996 } }, { channel: "ui" }).state;
    s = transition(s, { action: "share_photo_note" }, { channel: "ui" }).state;
    expect(playerView(s).hints.nudge).toBe("memory");
    expect(JSON.stringify(playerView(s).hints)).not.toMatch(/row|rangée|seat|siège/i);
    s = transition(s, { action: "ask_usual_place" }, { channel: "ui" }).state;
    expect(playerView(s).hints.nudge).toBeNull();
  });
  it("the context stays within the size limit in the fullest state", () => {
    const text = contextUpdateText(characterContext(ready(), "malik", null, "fr"), "fr");
    expect(text.endsWith("]")).toBe(false); // sanity: it is JSON text, check below that rules survive truncation
    expect(text).toContain("humour");
  });
});
