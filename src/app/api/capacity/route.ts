// Public: are there conversation slots left for a new player? Counts only (no ids, no users).
import { capacitySnapshot } from "@/server/napster/conversation";
import { handler, json } from "@/server/security/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const c = await capacitySnapshot();
  return json({ live: c.live, available: !c.live || c.free >= c.perPlayer });
});
