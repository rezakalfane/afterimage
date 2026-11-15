// Distributed admission, one conversation per run, forged tools, era switch, uncertain creates.
import { napsterCalls, napsterMode } from "../support/napster-stub";
import { beforeEach, describe, expect, it } from "vitest";
import { guest } from "../support/http";
import { sqlClient } from "@/server/db/client";

beforeEach(async () => {
  napsterMode("ok");
  await sqlClient().execute(`UPDATE conversation_leases SET status = 'closed'`);
});

describe("admission", () => {
  it("global cap (NAPSTER_MAX_ACTIVE=2): the third conversation is refused without calling Napster", async () => {
    const players = await Promise.all([guest("p1"), guest("p2"), guest("p3")]);
    const runs = await Promise.all(players.map(async (p) => (await p.createRun()).body.runId as string));
    const r1 = await players[0].openConversation(runs[0]);
    const r2 = await players[1].openConversation(runs[1]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    const before = napsterCalls.filter((c) => c.method === "POST").length;
    const r3 = await players[2].openConversation(runs[2]);
    expect(r3.status).toBe(503);
    expect(r3.body.code).toBe("CAPACITY_FULL");
    expect(napsterCalls.filter((c) => c.method === "POST").length).toBe(before);
    // Closing frees the slot.
    expect((await players[0].closeConversation(runs[0])).status).toBe(200);
    expect((await players[2].openConversation(runs[2])).status).toBe(200);
  });

  it("concurrent opens: never more than the cap, never two on one run", async () => {
    const ps = await Promise.all([1, 2, 3, 4].map((i) => guest(`c${i}`)));
    const runs = await Promise.all(ps.map(async (p) => (await p.createRun()).body.runId as string));
    const results = await Promise.all([...ps.map((p, i) => p.openConversation(runs[i])), ps[0].openConversation(runs[0])]);
    expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(2);
    const open = await sqlClient().execute(`SELECT run_id, count(*) n FROM conversation_leases WHERE status IN ('reserved','active','closing','uncertain') GROUP BY run_id`);
    expect(open.rows.every((r) => Number(r.n) === 1)).toBe(true);
    expect(open.rows.length).toBeLessThanOrEqual(2);
  });

  it("a new open takes over the owner's previous lease; the memory id is per run+character and reused on resume", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    const o0 = await a.openConversation(runId);
    // Same owner again (reload, language switch, second tab): the old lease is closed, never two at once.
    const deletesBefore = napsterCalls.filter((c) => c.method === "DELETE").length;
    const o1 = await a.openConversation(runId);
    expect(o1.status).toBe(200);
    expect(o1.body.leaseId).not.toBe(o0.body.leaseId);
    expect(napsterCalls.filter((c) => c.method === "DELETE").length).toBe(deletesBefore + 1);
    const open = await sqlClient().execute({ sql: `SELECT id FROM conversation_leases WHERE run_id = ? AND status IN ('reserved','active','closing','uncertain')`, args: [runId] });
    expect(open.rows.map((r) => r.id)).toEqual([o1.body.leaseId]);
    expect((await a.tool(runId, "malik_examine", { objet: "photo" }, o0.body.leaseId)).body.code).toBe("LEASE_INVALID");
    const create1 = napsterCalls.filter((c) => c.method === "POST").at(-1)!.body as Record<string, unknown>;
    expect(String(create1.externalClientId)).toMatch(/^ai_[a-f0-9]{28}$/);
    const sent = JSON.stringify(create1);
    expect(sent).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); // no email address
    expect(sent).not.toContain(process.env.NAPSTER_API_KEY!); // no provider key
    expect(sent).not.toContain(process.env.MEMORY_ID_SECRET!);
    await a.closeConversation(runId);
    await a.openConversation(runId);
    const create2 = napsterCalls.filter((c) => c.method === "POST").at(-1)!.body as Record<string, unknown>;
    expect(create2.externalClientId).toBe(create1.externalClientId);
    expect(o1.body.token).toBeTruthy();
    await a.closeConversation(runId);
    const b = await guest("b");
    const runB = (await b.createRun()).body.runId;
    await b.openConversation(runB);
    const createB = napsterCalls.filter((c) => c.method === "POST").at(-1)!.body as Record<string, unknown>;
    expect(createB.externalClientId).not.toBe(create1.externalClientId);
    await b.closeConversation(runB);
  });

  it("a create without response stays 'uncertain' and keeps counting against capacity", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    napsterMode("timeout");
    const r = await a.openConversation(runId);
    expect(r.status).toBe(502);
    const lease = await sqlClient().execute({ sql: `SELECT status FROM conversation_leases WHERE run_id = ?`, args: [runId] });
    expect(lease.rows[0].status).toBe("uncertain");
  });
});

describe("close during open (race)", () => {
  it("a close that lands while the connection is being created: no token, provider session closed, lease closed", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    napsterMode("slow");
    const opening = a.openConversation(runId);
    await new Promise((r) => setTimeout(r, 120)); // the lease is 'reserved', the create call is in flight
    expect((await a.closeConversation(runId)).status).toBe(200);
    const opened = await opening;
    expect(opened.status).toBe(409);
    expect(opened.body.code).toBe("LEASE_INVALID");
    expect(opened.body.token).toBeUndefined();
    expect(napsterCalls.some((c) => c.method === "DELETE" && c.path.startsWith("/public/connections/"))).toBe(true);
    const leases = await sqlClient().execute({ sql: `SELECT status FROM conversation_leases WHERE run_id = ?`, args: [runId] });
    expect(leases.rows.map((r) => r.status)).toEqual(["closed"]);
  });
});

describe("delete my run", () => {
  it("a failed provider close returns 202; a retry finishes; maintenance purges tombstones", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    await a.openConversation(runId);
    napsterMode("delete-fails");
    expect((await a.deleteRun(runId)).status).toBe(202);
    expect((await a.getRun(runId)).status).toBe(404); // hidden while deleting
    napsterMode("ok");
    expect((await a.deleteRun(runId)).status).toBe(200);
    const left = await sqlClient().execute({ sql: `SELECT count(*) n FROM runs WHERE id = ?`, args: [runId] });
    expect(Number(left.rows[0].n)).toBe(0);
    // Another player cannot delete (or probe) someone else's run, even a tombstone.
    const b = await guest("b");
    const runB = (await b.createRun()).body.runId;
    expect((await a.deleteRun(runB)).status).toBe(404);
  });

  it("maintenance purges a tombstone once its lease is reconciled", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    await a.openConversation(runId);
    napsterMode("delete-fails");
    expect((await a.deleteRun(runId)).status).toBe(202);
    napsterMode("ok");
    const { runMaintenance } = await import("@/server/jobs/maintenance");
    await sqlClient().execute(`UPDATE provider_budgets SET next_allowed_at = 0 WHERE scope = 'lock:maintenance'`);
    await runMaintenance();
    const left = await sqlClient().execute({ sql: `SELECT count(*) n FROM runs WHERE id = ?`, args: [runId] });
    expect(Number(left.rows[0].n)).toBe(0);
  });
});

describe("tool proposals", () => {
  it("are accepted only from the caller's active lease, for the current era's character", async () => {
    const a = await guest("a");
    const runId = (await a.createRun()).body.runId;
    const { leaseId } = (await a.openConversation(runId)).body;
    expect((await a.tool(runId, "malik_examine", { objet: "photo" }, "lease_forged")).body.code).toBe("LEASE_INVALID");
    const ok = await a.tool(runId, "malik_examine", { objet: "photo" }, leaseId, "call_same");
    expect(ok.body).toMatchObject({ ok: true, revision: 1 });
    expect(ok.body.output.contexte).toContain("notre place habituelle");
    expect(ok.body.output.contexte).not.toContain("G7");
    const replay = await a.tool(runId, "malik_examine", { objet: "photo" }, leaseId, "call_same"); // SDK duplicate
    expect(replay.body.revision).toBe(1);
    // Jeanne's tool through Malik's lease, unknown tool, extra args: refused, no mutation.
    for (const [name, args] of [["jeanne_act", { geste: "ouvrir_armoire" }], ["execute_sql", { q: "x" }], ["malik_examine", { objet: "photo", tenantId: "x" }], ["malik_act", { geste: "recuperer_cache" }]] as const) {
      const r = await a.tool(runId, name, args, leaseId);
      expect(r.body.ok).toBe(false);
      expect(r.body.revision).toBe(1);
    }
    // Switching era from the UI ends the open conversation of the previous era first.
    expect((await a.command(runId, "switch_era", { era: 1996 }, 1)).body.ok).toBe(true);
    const still = await sqlClient().execute({ sql: `SELECT 1 FROM conversation_leases WHERE run_id = ? AND status IN ('reserved','active','closing')`, args: [runId] });
    expect(still.rows.length).toBe(0);
    // The old lease can no longer act.
    expect((await a.tool(runId, "jeanne_examine", { objet: "programme" }, leaseId)).body.code).toBe("LEASE_INVALID");
  });

  it("heartbeat only for the owner's active lease", async () => {
    const a = await guest("a");
    const b = await guest("b");
    const runId = (await a.createRun()).body.runId;
    const { leaseId } = (await a.openConversation(runId)).body;
    expect((await a.heartbeat(runId, leaseId)).status).toBe(200);
    expect((await b.heartbeat(runId, leaseId)).status).toBe(409);
    await a.closeConversation(runId);
  });
});
