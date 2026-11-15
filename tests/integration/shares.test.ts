// Player-backed shares: a character's tool can record "the player said…" only if the player's own
// recent turn in this session says it. The turn is stored as indicators only, never as text.
import { napsterMode } from "../support/napster-stub";
import { beforeEach, describe, expect, it } from "vitest";
import { guest } from "../support/http";
import { sqlClient } from "@/server/db/client";

beforeEach(async () => {
  napsterMode("ok");
  await sqlClient().execute(`UPDATE conversation_leases SET status = 'closed'`);
});

async function jeanneSession() {
  const p = await guest("shares");
  const runId = (await p.createRun()).body.runId as string;
  let rev = 0;
  for (const [a, args] of [["inspect_photo"], ["switch_era", { era: 1996 }]] as [string, Record<string, unknown>?][]) rev = (await p.command(runId, a, args, rev)).body.revision;
  const { leaseId } = (await p.openConversation(runId)).body;
  return { p, runId, leaseId: leaseId as string };
}

describe("player-backed shares", () => {
  it("an autonomous claim is refused; the same claim after the player said it is accepted", async () => {
    const { p, runId, leaseId } = await jeanneSession();
    const refused = await p.tool(runId, "jeanne_use_clue", { indice: "venir_du_futur" }, leaseId);
    expect(refused.body.ok).toBe(false);
    expect((await p.getRun(runId)).body.publicState.revision).toBe(2); // nothing recorded
    expect((await p.turn(runId, leaseId, "Je viens de 2026, je vous assure.")).status).toBe(200);
    const ok = await p.tool(runId, "jeanne_use_clue", { indice: "venir_du_futur" }, leaseId);
    expect(ok.body.ok).toBe(true);
    // Only indicators are stored, never the text.
    const row = (await sqlClient().execute({ sql: `SELECT * FROM player_turns WHERE run_id = ?`, args: [runId] })).rows[0] as Record<string, unknown>;
    expect(row.mentions_future).toBe(1);
    expect(JSON.stringify(row)).not.toContain("assure");
  });
  it("a seat proposed by the model alone is refused; the player's own seat is accepted when the clues are gathered", async () => {
    const { p, runId, leaseId } = await jeanneSession();
    await p.turn(runId, leaseId, "J'ai trouvé une note au dos d'une photo.");
    expect((await p.tool(runId, "jeanne_use_clue", { indice: "note_photo" }, leaseId)).body.ok).toBe(true);
    expect((await p.tool(runId, "jeanne_recall", { sujet: "place_habituelle" }, leaseId)).body.ok).toBe(true);
    expect((await p.tool(runId, "jeanne_examine", { objet: "programme" }, leaseId)).body.ok).toBe(true);
    expect((await p.tool(runId, "jeanne_check_seat", { siege: "G7" }, leaseId)).body.ok).toBe(false); // the player never said it
    await p.turn(runId, leaseId, "Essayez la septième place de la rangée G.");
    expect((await p.tool(runId, "jeanne_check_seat", { siege: "G7" }, leaseId)).body.ok).toBe(true);
  });
  it("a skipped share is recorded first only when the player's own turn backs it", async () => {
    const { p, runId, leaseId } = await jeanneSession();
    expect((await p.tool(runId, "jeanne_recall", { sujet: "place_habituelle" }, leaseId)).body.ok).toBe(false); // nothing said yet
    await p.turn(runId, leaseId, "Au dos d’une photo, une note dit : la clé est à notre place habituelle.");
    expect((await p.tool(runId, "jeanne_recall", { sujet: "place_habituelle" }, leaseId)).body.ok).toBe(true); // note recorded first, then the memory
    expect((await p.tool(runId, "jeanne_examine", { objet: "programme" }, leaseId)).body.ok).toBe(true);
    await p.turn(runId, leaseId, "Cherchez sous le siège G sept.");
    expect((await p.tool(runId, "jeanne_act", { geste: "chercher_cle" }, leaseId)).body.ok).toBe(true); // seat checked first, then the key
    expect((await p.getRun(runId)).body.publicState.notebook.map((n: { id: string }) => n.id)).toContain("key");
  });
  it("turns need the caller's active lease of this run", async () => {
    const { p, runId } = await jeanneSession();
    expect((await p.turn(runId, "lease_forged", "bonjour")).status).toBe(409);
    const other = await guest("intruder");
    expect((await other.turn(runId, "lease_forged", "bonjour")).status).toBe(404);
  });
});
