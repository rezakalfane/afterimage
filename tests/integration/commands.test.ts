// Transactions, optimistic revision, idempotency, endings, exact message.
import "../support/napster-stub";
import { describe, expect, it } from "vitest";
import { cid, guest, playToDecision } from "../support/http";
import { sqlClient } from "@/server/db/client";

async function events(runId: string) {
  return (await sqlClient().execute({ sql: `SELECT revision, type FROM run_events WHERE run_id = ? ORDER BY revision`, args: [runId] })).rows;
}

describe("commands", () => {
  it("refuses early actions without mutating, with a safe French message", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    const r = await a.command(runId, "find_future_key", undefined, 0);
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ ok: false, code: "PREREQUISITE_MISSING", revision: 0 });
    expect(r.body.message).toMatch(/rien de nouveau/i);
    expect(await events(runId)).toHaveLength(0);
  });

  it("same commandId twice → one event; same id with another payload → 409", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    const id = cid();
    const r1 = await a.command(runId, "inspect_photo", undefined, 0, id);
    const r2 = await a.command(runId, "inspect_photo", undefined, 0, id); // network retry
    expect(r1.body).toEqual(r2.body);
    expect(await events(runId)).toHaveLength(1);
    const r3 = await a.command(runId, "inspect_waterline", undefined, 0, id);
    expect(r3.status).toBe(409);
    expect(r3.body.code).toBe("IDEMPOTENCY_MISMATCH");
  });

  it("two concurrent commands on the same revision: exactly one wins", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    const [x, y] = await Promise.all([a.command(runId, "inspect_photo", undefined, 0), a.command(runId, "inspect_waterline", undefined, 0)]);
    const statuses = [x.status, y.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = x.status === 409 ? x : y;
    expect(loser.body.code).toBe("REVISION_CONFLICT");
    expect(loser.body.publicState.revision).toBe(1); // fresh state for the client
    expect(await events(runId)).toHaveLength(1);
  });

  it("a stale expectedRevision is a conflict, never a silent overwrite", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    await a.command(runId, "inspect_photo", undefined, 0);
    expect((await a.command(runId, "inspect_waterline", undefined, 0)).body.code).toBe("REVISION_CONFLICT");
  });

  it("the three endings, exact message, single-use UI confirmation", async () => {
    for (const ending of ["public_cut", "sealed_archive", "broken_promise"]) {
      const a = await guest("a");
      const runId = (await a.createRun()).body.runId;
      const phrase = `<img src=x onerror=alert(1)> Étoiles 🌙 « ${ending} »`;
      const rev = await playToDecision(a, runId, phrase);
      const view = (await a.getRun(runId)).body.publicState;
      expect(view.message.recovered).toBe(phrase); // exact, as text
      expect(view.endings).toHaveLength(3);
      // choose_ending is not a command.
      expect((await a.command(runId, "choose_ending", { ending }, rev)).status).toBe(400);
      const intent = await a.endingIntent(runId, ending, rev);
      expect(intent.status).toBe(200);
      const b = await guest("b");
      expect((await b.confirmEnding(runId, intent.body.token)).status).toBe(404);
      const done = await a.confirmEnding(runId, intent.body.token);
      expect(done.body).toMatchObject({ ok: true, publicState: { ending, phase: "finished" } });
      expect(done.body.publicState.closing).toBeTruthy();
      // The character context stays server-side; only a farewell text for the live character is returned.
      expect(done.body.characterContext).toBeUndefined();
      expect(String(done.body.farewell)).toMatch(/dernière phrase|last sentence/);
      const reuse = await a.confirmEnding(runId, intent.body.token);
      expect(reuse.status).toBe(409); // run finished; token cannot be reused
      expect((await a.command(runId, "switch_era", { era: 1996 }, done.body.revision)).status).toBe(409);
    }
  });

  it("an ending intent cannot be created before the readings", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    expect((await a.endingIntent(runId, "public_cut", 0)).status).toBe(400);
  });

  it("player state never contains undiscovered documents", async () => {
    const a = await guest("a");
    const r = await a.createRun();
    const s = JSON.stringify(r.body);
    for (const secret of ["G7", "épilogue", "2008", "étagère haute"]) expect(s).not.toContain(secret);
  });
});
