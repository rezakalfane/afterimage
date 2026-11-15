// npm run ops:napster-usage — read-only: Napster sessions, open sessions and summed cost (USD).
// Budget rule (2026-11-15): max $150, warn at $100 consumed, keep ~$30 for the final run.
import { loadEnv } from "./lib/env-file";

loadEnv();
const KEY = process.env.NAPSTER_API_KEY;
if (!KEY) throw new Error("NAPSTER_API_KEY absent");
let page = 0, total = 0, cost = 0;
const open: string[] = [];
for (;;) {
  const r = await fetch(`https://companion-api.napster.com/public/sessions?pageSize=100&pageIndex=${page}`, { headers: { "X-Api-Key": KEY } });
  const d = (await r.json()) as { items: Array<{ id: string; status: string; cost?: number | null; sessionType: string }>; totalCount: number };
  for (const s of d.items) {
    total++;
    cost += s.cost ?? 0;
    if (s.status === "pending" || s.status === "started") open.push(`${s.sessionType}:${s.id.slice(0, 10)}…(${s.status})`);
  }
  if ((page + 1) * 100 >= d.totalCount || d.items.length === 0) break;
  page++;
}
console.log(`sessions: ${total} · cost: $${cost.toFixed(2)} of $150 budget · open: ${open.length ? open.join(", ") : "none"}`);
if (cost >= 100) console.log("⚠ $100 reached: tell the user before spending more.");
if (cost >= 120) console.log("⚠ less than $30 left for the final acceptance and demo.");
