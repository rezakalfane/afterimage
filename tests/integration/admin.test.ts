import "../support/napster-stub";
import { describe, expect, it } from "vitest";
import { guest, playToDecision, tenantWithMember } from "../support/http";
import * as overview from "@/app/api/admin/overview/route";
import * as invitations from "@/app/api/admin/invitations/route";
import * as members from "@/app/api/admin/members/[userId]/route";

describe("admin surface", () => {
  it("guests and players are refused; an admin sees only their own tenant, never messages or secrets", async () => {
    const g = await guest("g");
    expect((await g.req(overview.GET, "/api/admin/overview")).status).toBe(403);
    const { player: p } = await tenantWithMember("player");
    expect((await p.req(overview.GET, "/api/admin/overview")).status).toBe(403);
    const { player: admin, tenantId } = await tenantWithMember("admin");
    const runId = (await admin.createRun()).body.runId;
    await playToDecision(admin, runId, "Canari-admin-secret");
    const r = await admin.req(overview.GET, "/api/admin/overview");
    expect(r.status).toBe(200);
    const s = JSON.stringify(r.body);
    expect(s).not.toContain("Canari-admin-secret");
    expect(s).not.toContain(process.env.NAPSTER_API_KEY!);
    expect(r.body.members.every((m: { email: string }) => !m.email.includes("guest.afterimage.local"))).toBe(true);
    expect(r.body.tenant).toMatchObject({ public: false });
    void tenantId;
  });

  it("an admin cannot invite another admin or remove members; only the owner can", async () => {
    const { player: admin } = await tenantWithMember("admin");
    expect((await admin.req(invitations.POST, "/api/admin/invitations", { method: "POST", body: { email: "x@example.test", role: "admin" } })).status).toBe(403);
    const ok = await admin.req(invitations.POST, "/api/admin/invitations", { method: "POST", body: { email: "x@example.test", role: "player" } });
    expect(ok.status).toBe(201);
    expect(ok.body.link).toMatch(/\/invitation\/[A-Za-z0-9_-]{40,}\?email=/);
    expect((await admin.req(members.DELETE, "/api/admin/members/u1", { method: "DELETE", params: { userId: "u1" } })).status).toBe(403);
  });
});
