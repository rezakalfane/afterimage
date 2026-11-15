// Access control across players of the SAME public tenant and across tenants.
import "../support/napster-stub";
import { describe, expect, it } from "vitest";
import { guest, Player, tenantWithMember } from "../support/http";
import * as runRoute from "@/app/api/runs/[runId]/route";

describe("authentication and origin", () => {
  it("rejects anonymous callers and cross-site mutations", async () => {
    const anon = new Player("anon");
    expect((await anon.createRun()).status).toBe(401);
    const a = await guest("a");
    const bad = await a.req((await import("@/app/api/runs/route")).POST, "/api/runs", { method: "POST", origin: "https://evil.example" });
    expect(bad.status).toBe(403);
    const none = await a.req((await import("@/app/api/runs/route")).POST, "/api/runs", { method: "POST", origin: null });
    expect(none.status).toBe(403);
  });
});

describe("two players of the same public tenant", () => {
  it("cannot read, command, delete or converse in each other's run", async () => {
    const a = await guest("a");
    const b = await guest("b");
    const runA = (await a.createRun()).body.runId as string;
    expect((await a.getRun(runA)).status).toBe(200);
    expect((await b.getRun(runA)).status).toBe(404);
    expect((await b.command(runA, "inspect_photo", undefined, 0)).status).toBe(404);
    expect((await b.deleteRun(runA)).status).toBe(404);
    expect((await b.openConversation(runA)).status).toBe(404);
    expect((await b.tool(runA, "malik_examine", { objet: "photo" }, "lease_forged")).status).toBe(404);
    expect((await b.endingIntent(runA, "public_cut", 0)).status).toBe(404);
    // Unknown and malformed ids look the same as foreign ones.
    expect((await a.getRun("run_" + "0".repeat(32))).status).toBe(404);
    expect((await a.getRun("../../etc")).status).toBe(404);
    // A's run is intact.
    expect((await a.getRun(runA)).body.revision).toBe(0);
  });
});

describe("tenants", () => {
  it("a member of tenant T cannot reach a public-tenant run, even by forging the tenant cookie", async () => {
    const a = await guest("a");
    const runA = (await a.createRun()).body.runId as string;
    const { player: m } = await tenantWithMember();
    expect((await m.getRun(runA)).status).toBe(404);
    const forged = await m.req(runRoute.GET, `/api/runs/${runA}`, { params: { runId: runA }, extraCookie: "afterimage_tenant=demo" });
    expect(forged.status).toBe(404);
    // The guest cannot switch into tenant T by cookie either: its own run list stays in the public tenant.
    const runM = (await m.createRun()).body.runId as string;
    const g = await a.req(runRoute.GET, `/api/runs/${runM}`, { params: { runId: runM }, extraCookie: "afterimage_tenant=t1" });
    expect(g.status).toBe(404);
  });

  it("sign-up requires a valid, unused invitation for the same email", async () => {
    const p = new Player("x");
    expect((await p.signUp("nobody@example.test")).status).toBe(403);
    const { email, token } = await tenantWithMember();
    const again = new Player("y");
    expect((await again.signUp(email, token)).status).not.toBe(200); // already consumed (email also taken)
    const other = new Player("z");
    expect((await other.signUp("other@example.test", token)).status).toBe(403); // wrong email
  });
});
