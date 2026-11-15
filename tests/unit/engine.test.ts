// Engine tests: the kit's reference tests (tests/world.test.mjs) ported, plus the documented changes.
import { describe, expect, it } from "vitest";
import { availableActions, initialState, transition } from "@/server/world/engine";

import { apply, ready, ui } from "../support/ready";

describe("complete paths", () => {
  for (const ending of ["public_cut", "sealed_archive", "broken_promise"]) {
    it(`reaches ending ${ending}`, () => {
      const r = apply(ready(), "choose_ending", { ending }, { channel: "ending-confirmed" });
      expect(r.phase).toBe("finished");
      expect(r.ending).toBe(ending);
      expect(transition(r, { action: "switch_era", args: { era: 1996 } }, ui)).toMatchObject({ ok: false, code: "RUN_FINISHED" });
    });
  }
  it("accepts the clues in another order (1996 first, then 2026)", () => {
    let s = apply(initialState(), "switch_era", { era: 1996 });
    s = apply(s, "inspect_programme");
    expect(transition(s, { action: "relay_key_location" }, ui)).toMatchObject({ code: "PREREQUISITE_MISSING" }); // needs the photo first
    s = apply(apply(s, "switch_era", { era: 2026 }), "inspect_photo");
    s = apply(apply(s, "switch_era", { era: 1996 }), "relay_key_location");
    expect(s.flags).toContain("key_location_shared");
  });
});

describe("2026: key behind the projector, then the cabinet", () => {
  it("the cabinet cannot be opened before finding the key", () => {
    let s = ready();
    s = { ...s, flags: s.flags.filter((f) => !["future_key_found", "cache_recovered", "message_read", "future_letter_read"].includes(f)) };
    expect(transition(s, { action: "recover_cache" }, ui)).toMatchObject({ ok: false, code: "PREREQUISITE_MISSING" });
    s = apply(s, "find_future_key");
    expect(apply(s, "recover_cache").flags).toContain("cache_recovered");
  });
  it("the key cannot be found before Jeanne stored the cache", () => {
    expect(transition(initialState(), { action: "find_future_key" }, ui)).toMatchObject({ code: "PREREQUISITE_MISSING" });
  });
});

describe("the cabinet can be closed again (freedom, no canon change)", () => {
  it("1996: close, reading is refused while closed, reopen with the same gesture", () => {
    let s = apply(initialState(), "inspect_photo");
    s = apply(s, "switch_era", { era: 1996 });
    for (const a of ["relay_key_location", "retrieve_key", "open_cabinet", "inspect_programme"]) s = apply(s, a);
    s = apply(s, "close_cabinet");
    expect(s.flags).toContain("door_closed_1996");
    expect(transition(s, { action: "read_letter" }, ui)).toMatchObject({ ok: false, code: "PREREQUISITE_MISSING", detail: "door" });
    expect(transition(s, { action: "close_cabinet" }, ui)).toMatchObject({ ok: true, changed: false }); // already closed
    s = apply(s, "open_cabinet");
    expect(s.flags).not.toContain("door_closed_1996");
    expect(apply(s, "read_letter").flags).toContain("letter_read");
  });
  it("2026: close after recovering, reopen with recover_cache; cannot close a locked cabinet", () => {
    expect(transition(initialState(), { action: "close_cabinet" }, ui)).toMatchObject({ ok: false, code: "PREREQUISITE_MISSING" });
    let s = apply(ready(), "close_cabinet");
    expect(availableActions(s, ui)).toContain("recover_cache");
    expect(transition(s, { action: "read_message" }, ui)).toMatchObject({ ok: false, detail: "door" });
    s = apply(s, "recover_cache");
    expect(s.flags).not.toContain("door_closed_2026");
  });
});

describe("refusals never mutate", () => {
  it("wrong era and prerequisites", () => {
    const s = initialState();
    const before = structuredClone(s);
    expect(transition(s, { action: "open_cabinet" }, ui)).toMatchObject({ code: "WRONG_ERA" });
    expect(transition(s, { action: "recover_cache" }, ui)).toMatchObject({ code: "PREREQUISITE_MISSING" });
    expect(s).toEqual(before);
  });
  it("unknown and prototype names", () => {
    for (const action of ["set_state", "__proto__", "constructor", "execute_sql"]) expect(transition(initialState(), { action }, ui)).toMatchObject({ code: "UNKNOWN_ACTION" });
  });
  it("strict arguments; identity cannot be passed as argument", () => {
    expect(transition(initialState(), { action: "inspect_photo", args: { tenantId: "other" } }, ui)).toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(transition(initialState(), { action: "inspect_photo", channel: "ui" } as never, ui)).toMatchObject({ code: "INVALID_ARGUMENT" });
  });
  it("wrong storage place is refused with a reason, not destroyed", () => {
    let s = ready();
    s = { ...s, activeEra: 1996, flags: s.flags.filter((f) => !["cache_preserved", "cache_recovered", "message_read", "future_letter_read"].includes(f)), storage: null };
    for (const location of ["desk", "floor", "lower_cabinet"]) {
      expect(transition(s, { action: "preserve_cache", args: { location } }, ui)).toMatchObject({ ok: false, code: "WRONG_LOCATION", detail: location });
    }
    expect(apply(s, "preserve_cache", { location: "upper_cabinet" }).storage).toBe("upper_cabinet");
  });
});

describe("channels", () => {
  it("tools cannot impersonate a character, confirm the message, switch era or choose an ending", () => {
    expect(transition(initialState(), { action: "inspect_photo" }, { channel: "tool", character: "jeanne" })).toMatchObject({ code: "WRONG_CHARACTER" });
    expect(transition(ready(), { action: "choose_ending", args: { ending: "public_cut" } }, { channel: "tool", character: "malik" })).toMatchObject({ code: "UI_CONFIRMATION_REQUIRED" });
    expect(transition(initialState(), { action: "switch_era", args: { era: 1996 } }, { channel: "tool", character: "malik" })).toMatchObject({ code: "UI_CONFIRMATION_REQUIRED" });
    expect(transition(initialState(), { action: "inspect_photo" }, { channel: "nope" } as never)).toMatchObject({ code: "UNTRUSTED_CHANNEL" });
    expect(transition(ready(), { action: "choose_ending", args: { ending: "public_cut" } }, ui)).toMatchObject({ code: "UI_CONFIRMATION_REQUIRED" });
    expect(transition(initialState(), { action: "inspect_photo" }, { channel: "ending-confirmed" })).toMatchObject({ code: "UNTRUSTED_CHANNEL" });
  });
  it("the right character may act through a tool", () => {
    expect(transition(initialState(), { action: "inspect_photo" }, { channel: "tool", character: "malik" })).toMatchObject({ ok: true, changed: true });
  });
});

describe("revision and idempotent no-ops", () => {
  it("a no-op does not increment the revision", () => {
    const s = apply(initialState(), "inspect_photo");
    const r = transition(s, { action: "inspect_photo" }, ui);
    expect(r).toMatchObject({ ok: true, changed: false });
    expect(r.state.revision).toBe(1);
  });
});

describe("personal message", () => {
  it("is preserved exactly, as text, isolated between runs, locked after sealing", () => {
    const phrase = "<script>bonjour</script> — Étoiles 🌙\nligne 2";
    const a = ready(phrase);
    const b = ready("Un autre souvenir");
    expect(a.message).toBe(phrase);
    expect(a.message).not.toBe(b.message);
    const past = apply(a, "switch_era", { era: 1996 });
    expect(transition(past, { action: "write_message", args: { text: "changed" } }, ui)).toMatchObject({ code: "MESSAGE_LOCKED" });
  });
  it("validation, NFC normalisation, reconfirmation and UI-only confirmation", () => {
    let s = ready();
    s = { ...s, activeEra: 1996, ending: null, storage: null, message: null, messageDraft: null, flags: s.flags.filter((f) => !["cache_preserved", "cache_recovered", "message_read", "future_letter_read", "message_confirmed"].includes(f)) };
    for (const text of ["", "   ", "a".repeat(241), "\u0000bad", "‮evil"]) expect(transition(s, { action: "write_message", args: { text } }, ui)).toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(apply(s, "write_message", { text: "😀".repeat(240) }).messageDraft).toHaveLength(480); // 240 code points
    s = apply(s, "write_message", { text: "Café" });
    expect(s.messageDraft).toBe("Café");
    expect(s.message).toBeNull();
    expect(transition(s, { action: "confirm_message", args: { text: "Café" } }, { channel: "tool", character: "jeanne" })).toMatchObject({ code: "UI_CONFIRMATION_REQUIRED" });
    expect(transition(s, { action: "confirm_message", args: { text: "wrong" } }, ui)).toMatchObject({ code: "INVALID_ARGUMENT" });
    s = apply(s, "confirm_message", { text: "Café" });
    expect(s.flags).toContain("message_confirmed");
    s = apply(s, "write_message", { text: "Autre chose" });
    expect(s.flags).not.toContain("message_confirmed"); // editing invalidates the confirmation
  });
  it("cannot be preserved before confirmation", () => {
    let s = ready();
    s = { ...s, activeEra: 1996, flags: s.flags.filter((f) => !["cache_preserved", "cache_recovered", "message_read", "future_letter_read", "message_confirmed"].includes(f)) };
    expect(transition(s, { action: "preserve_cache", args: { location: "upper_cabinet" } }, ui)).toMatchObject({ code: "PREREQUISITE_MISSING" });
  });
});

describe("hints and availability", () => {
  it("three progressive levels per topic, never past 3", () => {
    let s = initialState();
    for (let i = 0; i < 5; i++) s = apply(s, "request_hint");
    expect(s.hintLevels.key).toBe(3);
    expect(s.hintsUsed).toBe(5);
  });
  it("available actions come from the engine", () => {
    const a = availableActions(initialState(), ui);
    expect(a).toContain("inspect_photo");
    expect(a).not.toContain("open_cabinet");
    expect(availableActions(initialState(), { channel: "tool", character: "malik" })).not.toContain("switch_era");
  });
});

import { toolToCommand } from "@/server/napster/tools";
describe("tool argument tolerance (still validated)", () => {
  it("a location given with another gesture is ignored; JSON-string arguments are parsed", () => {
    expect(toolToCommand("jeanne", "jeanne_act", { geste: "chercher_cle", emplacement: "siege_g7" })).toMatchObject({ ok: true, command: { action: "retrieve_key" } });
    expect(toolToCommand("jeanne", "jeanne_act", '{"geste":"ouvrir_armoire"}')).toMatchObject({ ok: true, command: { action: "open_cabinet" } });
    expect(toolToCommand("jeanne", "jeanne_act", { geste: "conserver", emplacement: "siege_g7" })).toEqual({ ok: false });
    expect(toolToCommand("jeanne", "jeanne_act", "{not json")).toEqual({ ok: false });
    expect(toolToCommand("malik", "malik_act", { geste: "fermer_armoire" })).toMatchObject({ ok: true, command: { action: "close_cabinet" } });
  });
});
