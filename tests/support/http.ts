// Call Next.js route handlers directly with real Request objects and cookie jars.
import * as authRoute from "@/app/api/auth/[...all]/route";
import * as runsRoute from "@/app/api/runs/route";
import * as runRoute from "@/app/api/runs/[runId]/route";
import * as commandsRoute from "@/app/api/runs/[runId]/commands/route";
import * as toolRoute from "@/app/api/runs/[runId]/tool/route";
import * as convRoute from "@/app/api/runs/[runId]/conversation/route";
import * as hbRoute from "@/app/api/runs/[runId]/heartbeat/route";
import * as intentRoute from "@/app/api/runs/[runId]/ending-intent/route";
import * as endingRoute from "@/app/api/runs/[runId]/ending/route";
import { createInvitation } from "@/server/auth/invitations";
import { sqlClient } from "@/server/db/client";

export const ORIGIN = "http://localhost:3000";
let seq = 0;
export const cid = () => `test:${Date.now()}:${++seq}`;

export class Player {
  cookie = "";
  constructor(public label: string) {}
  async req(handler: (req: Request, ctx: never) => Promise<Response>, path: string, init: { method?: string; body?: unknown; origin?: string | null; params?: Record<string, string>; extraCookie?: string } = {}) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (init.origin !== null) headers.set("Origin", init.origin ?? ORIGIN);
    const cookie = [this.cookie, init.extraCookie].filter(Boolean).join("; ");
    if (cookie) headers.set("Cookie", cookie);
    const req = new Request(ORIGIN + path, { method: init.method ?? "GET", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
    const res = await handler(req, { params: Promise.resolve(init.params ?? {}) } as never);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(";");
      const [name] = pair.split("=");
      this.cookie = [...this.cookie.split("; ").filter((x) => x && !x.startsWith(name + "=")), pair].join("; ");
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  }
  signInGuest() {
    return this.req(authRoute.POST, "/api/auth/sign-in/anonymous", { method: "POST", body: {} });
  }
  signUp(email: string, invitationToken?: string) {
    return this.req(authRoute.POST, "/api/auth/sign-up/email", { method: "POST", body: { email, password: "correct-horse-battery-1", name: this.label, ...(invitationToken ? { invitationToken } : {}) } });
  }
  createRun() {
    return this.req(runsRoute.POST, "/api/runs", { method: "POST" });
  }
  getRun(runId: string) {
    return this.req(runRoute.GET, `/api/runs/${runId}`, { params: { runId } });
  }
  deleteRun(runId: string) {
    return this.req(runRoute.DELETE, `/api/runs/${runId}`, { method: "DELETE", params: { runId } });
  }
  command(runId: string, action: string, args: Record<string, unknown> | undefined, expectedRevision: number | undefined, commandId = cid()) {
    return this.req(commandsRoute.POST, `/api/runs/${runId}/commands`, { method: "POST", body: { commandId, expectedRevision, action, ...(args ? { args } : {}) }, params: { runId } });
  }
  tool(runId: string, name: string, args: unknown, conversationLeaseId: string, callId = `call_${++seq}`) {
    return this.req(toolRoute.POST, `/api/runs/${runId}/tool`, { method: "POST", body: { callId, name, args, conversationLeaseId }, params: { runId } });
  }
  openConversation(runId: string) {
    return this.req(convRoute.POST, `/api/runs/${runId}/conversation`, { method: "POST", params: { runId } });
  }
  closeConversation(runId: string) {
    return this.req(convRoute.DELETE, `/api/runs/${runId}/conversation`, { method: "DELETE", params: { runId } });
  }
  heartbeat(runId: string, leaseId: string) {
    return this.req(hbRoute.POST, `/api/runs/${runId}/heartbeat`, { method: "POST", body: { leaseId }, params: { runId } });
  }
  endingIntent(runId: string, ending: string, expectedRevision: number) {
    return this.req(intentRoute.POST, `/api/runs/${runId}/ending-intent`, { method: "POST", body: { ending, expectedRevision }, params: { runId } });
  }
  confirmEnding(runId: string, token: string, commandId = cid()) {
    return this.req(endingRoute.POST, `/api/runs/${runId}/ending`, { method: "POST", body: { token, commandId }, params: { runId } });
  }
}

export async function guest(label: string) {
  const p = new Player(label);
  const r = await p.signInGuest();
  if (r.status !== 200) throw new Error(`guest sign-in failed ${r.status} ${JSON.stringify(r.body)}`);
  return p;
}

let tenantSeq = 0;
export async function tenantWithMember(role: "owner" | "admin" | "player" = "player") {
  const id = `ten_test_${++tenantSeq}_${Date.now()}`;
  await sqlClient().execute({ sql: `INSERT INTO tenants (id, slug, name, status, is_public, max_active_sessions, created_at) VALUES (?,?,?,'active',0,2,?)`, args: [id, `t${tenantSeq}-${Date.now() % 100000}`, "Test", Date.now()] });
  const email = `m${tenantSeq}.${Date.now()}@example.test`;
  const token = await createInvitation({ tenantId: id, email, role, createdBy: null });
  const p = new Player(`member-${tenantSeq}`);
  const r = await p.signUp(email, token);
  if (r.status !== 200) throw new Error(`sign-up failed ${r.status} ${JSON.stringify(r.body)}`);
  return { player: p, tenantId: id, email, token };
}

/** Play a run from the start to the decision point through UI commands. */
export async function playToDecision(p: Player, runId: string, message = "Les étoiles restent allumées.") {
  const steps: [string, Record<string, unknown>?][] = [
    ["inspect_photo"], ["inspect_waterline"], ["switch_era", { era: 1996 }], ["relay_key_location"], ["retrieve_key"], ["open_cabinet"],
    ["inspect_programme"], ["read_letter"], ["acknowledge_permission"], ["relay_flood_warning"], ["write_message", { text: message }],
  ];
  let rev = 0;
  for (const [a, args] of steps) {
    const r = await p.command(runId, a, args, rev);
    if (!r.body.ok) throw new Error(`${a}: ${JSON.stringify(r.body)}`);
    rev = r.body.revision;
  }
  const draft = (await p.getRun(runId)).body.publicState.message.draft;
  for (const [a, args] of [["confirm_message", { text: draft }], ["preserve_cache", { location: "upper_cabinet" }], ["switch_era", { era: 2026 }], ["find_future_key"], ["recover_cache"], ["read_message"], ["read_future_letter"]] as [string, Record<string, unknown>?][]) {
    const r = await p.command(runId, a, args, rev);
    if (!r.body.ok) throw new Error(`${a}: ${JSON.stringify(r.body)}`);
    rev = r.body.revision;
  }
  return rev;
}
