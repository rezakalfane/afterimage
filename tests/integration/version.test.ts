// A run of an older chapter version is retired: saved and readable, refused on every mutation path,
// and not counted in the active-game quota.
import { napsterCalls, napsterMode } from "../support/napster-stub";
import { beforeEach, describe, expect, it } from "vitest";
import { guest } from "../support/http";
import { sqlClient } from "@/server/db/client";

beforeEach(async () => {
  napsterMode("ok");
  await sqlClient().execute(`UPDATE conversation_leases SET status = 'closed'`);
});

describe("retired chapter version", () => {
  it("refuses commands, tools, ending, rehearsal and conversations; GET still works; quota ignores it", async () => {
    const p = await guest("old");
    const runId = (await p.createRun()).body.runId as string;
    await sqlClient().execute(`INSERT OR IGNORE INTO episode_versions (episode_id, version, content_hash, content_json, published_at) SELECT episode_id, 1, 'previous', content_json, published_at FROM episode_versions LIMIT 1`);
    await sqlClient().execute({ sql: `UPDATE runs SET episode_version = 1 WHERE id = ?`, args: [runId] });
    const calls = napsterCalls.length;
    expect((await p.command(runId, "inspect_photo", undefined, 0)).body.code).toBe("VERSION_RETIRED");
    expect((await p.openConversation(runId)).body.code).toBe("VERSION_RETIRED");
    expect(napsterCalls.length).toBe(calls); // no provider call for a retired run
    expect((await p.tool(runId, "malik_examine", { objet: "photo" }, "lease_x")).body.code).toBe("VERSION_RETIRED");
    expect((await p.endingIntent(runId, "public_cut", 0)).body.code).toBe("VERSION_RETIRED");
    const g = await p.getRun(runId);
    expect(g.status).toBe(200);
    // Three active games of the CURRENT version are still allowed next to the retired one.
    for (let i = 0; i < 3; i++) expect((await p.createRun()).status).toBe(201);
  });
});
