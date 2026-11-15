// npm run check:bundle — after `next build`: the client bundle must contain no secret and no
// undiscovered canon. Prints COUNTS only (never the searched values).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./lib/env-file";
import episode from "../src/content/episodes/last-screening/v1/episode.json" with { type: "json" };

loadEnv();
const dir = join(process.env.NEXT_DIST_DIR || ".next", "static");
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|json|html|txt|map)$/.test(f)) files.push(p);
  }
};
walk(dir);
const needles: [string, string | undefined][] = [
  ["NAPSTER_API_KEY value", process.env.NAPSTER_API_KEY],
  ["BETTER_AUTH_SECRET value", process.env.BETTER_AUTH_SECRET],
  ["MEMORY_ID_SECRET value", process.env.MEMORY_ID_SECRET],
  ["CRON_SECRET value", process.env.CRON_SECRET],
  ["DATABASE_AUTH_TOKEN value", process.env.DATABASE_AUTH_TOKEN],
  ["X-Api-Key header", "X-Api-Key"],
  ["companion-api.napster.com/public/agents", "companion-api.napster.com/public/agents"],
  ["Alice's letter text", episode.documents.letter.slice(0, 40)],
  ["photo back (G7) text", episode.documents.photoBack],
  ["2008 report text", episode.documents.archiveReport.slice(0, 40)],
  ["closing texts", episode.documents.closingBreach.slice(0, 40)],
  ["canon truth", episode.canon.truth.slice(0, 40)],
  ["key location", episode.canon.keyLocation],
];
let bad = 0;
const contents = files.map((f) => readFileSync(f, "utf8"));
for (const [label, value] of needles) {
  if (!value) {
    console.log(`• ${label}: not set, skipped`);
    continue;
  }
  const hits = contents.filter((c) => c.includes(value)).length;
  if (hits) bad++;
  console.log(`${hits ? "✗" : "✓"} ${label}: ${hits} file(s)`);
}
console.log(`${files.length} client files scanned`);
process.exit(bad ? 1 : 0);
