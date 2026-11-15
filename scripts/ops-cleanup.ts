// npm run ops:cleanup — run maintenance once from the operator's machine (same code as the cron).
import { loadEnv } from "./lib/env-file";

loadEnv();
const { runMaintenance } = await import("../src/server/jobs/maintenance");
console.log(JSON.stringify(await runMaintenance(), null, 2));
process.exit(0);
