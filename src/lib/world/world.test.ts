import { describe, expect, it } from "vitest";
import { applyTool, factsFor, hideReel, inventory, leaveMessage, newWorld, search, viewOf, vhsScript } from "./world";

const T = 1_000;

describe("canon guardian", () => {
  it("Malik finds nothing where Jeanne hid nothing", () => {
    const r = search(newWorld("p1"), "armoire_croissant", "fr", T);
    expect(r.output.found).toEqual([]);
    expect(r.state.found).toEqual([]);
    expect(r.state.searched).toEqual(["armoire_croissant"]);
  });

  it("what Jeanne hides in 1996 is found in 2026, with the message and the tape", () => {
    let s = hideReel(newWorld("p1"), "armoire_croissant", T).state;
    s = leaveMessage(s, "Les étoiles restent allumées.", "fr", T).state;
    expect(s.vhs.status).toBe("pending");
    const r = search(s, "armoire_croissant", "fr", T);
    expect(r.state.found).toEqual(["bobine", "message", "cassette"]);
    expect(r.output.message_text).toBe("Les étoiles restent allumées.");
    expect(inventory(r.state, "2026")).toContain("cassette");
    expect(r.events.some((e) => e.type === "inventory")).toBe(true);
  });

  it("searching the wrong place finds nothing", () => {
    const s = hideReel(newWorld("p1"), "sous_projecteur", T).state;
    expect(search(s, "armoire_croissant", "en", T).state.found).toEqual([]);
  });

  it("changing the past erases what was found in the present", () => {
    let s = hideReel(newWorld("p1"), "armoire_croissant", T).state;
    s = search(s, "armoire_croissant", "fr", T).state;
    expect(s.found).toContain("bobine");
    const r = hideReel(s, "etagere_bobines", T);
    expect(r.state.found).toEqual([]);
    expect(r.state.timeline).toBe(1);
    expect(r.events).toContainEqual({ type: "timeline_changed", timeline: 1 });
  });

  it("the message must travel with the reel", () => {
    const r = leaveMessage(newWorld("p1"), "Bonjour", "fr", T);
    expect(r.output).toMatchObject({ ok: false, error: "hide_reel_first" });
  });

  it("rejects unknown places and tools from the wrong character", () => {
    expect(hideReel(newWorld("p1"), "nowhere", T).output).toMatchObject({ ok: false, error: "unknown_location" });
    expect(applyTool(newWorld("p1"), "malik", "cacher_bobine", { lieu: "armoire_croissant" }, "fr", T).output).toMatchObject({
      ok: false,
    });
  });

  it("Jeanne never learns the future; Malik only knows what he found", () => {
    let s = hideReel(newWorld("p1"), "armoire_croissant", T).state;
    s = search(s, "armoire_croissant", "fr", T).state;
    expect(factsFor("jeanne", s, "fr").join(" ")).not.toMatch(/found|searched/);
    expect(factsFor("malik", s, "fr").some((f) => f.startsWith("found:"))).toBe(true);
    expect(factsFor("malik", newWorld("p2"), "fr")).toEqual([]);
  });

  it("the VHS script is in the language the message was dictated in, and long enough for Napster", () => {
    let s = hideReel(newWorld("p1"), "armoire_croissant", T).state;
    s = leaveMessage(s, "Stars stay lit.", "en", T).state;
    const script = vhsScript(s)!;
    expect(script).toContain("Stars stay lit.");
    expect(script.startsWith("If anyone")).toBe(true);
    expect(script.length).toBeGreaterThanOrEqual(84);
  });

  it("the client view hides the message until it is found", () => {
    let s = hideReel(newWorld("p1"), "armoire_croissant", T).state;
    s = leaveMessage(s, "Secret", "fr", T).state;
    expect(viewOf(s).message).toBeNull();
    expect(viewOf(search(s, "armoire_croissant", "fr", T).state).message).toBe("Secret");
  });
});
