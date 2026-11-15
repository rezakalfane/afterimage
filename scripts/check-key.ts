// Read-only check of what the API key can do for AFTERIMAGE. Creates nothing.
//   npm run check-key
import { NapsterError, napster } from "../src/lib/napster/api";

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  ok    ${label}`);
  } catch (e) {
    const info = e instanceof NapsterError ? `${e.status} ${e.code ?? ""}` : String(e);
    console.log(`  FAIL  ${label} → ${info}`);
  }
}

async function main() {
  console.log("Napster API key check");
  await probe("auth + list agents", () => napster("/public/agents"));
  await probe("stock companion catalog", () => napster("/public/companions/napster-stock?pageSize=1"));
  await probe("sessions API", () => napster("/public/sessions?pageSize=1"));
  // A fake companion id: "RecordingsApiNotEnabled" means the feature is off; a not-found error means it is on.
  try {
    await napster("/public/companions/00000000-0000-0000-0000-000000000000/recordings", {
      method: "POST",
      body: { voiceId: "coral", text: "x".repeat(90) },
    });
    console.log("  ok    video recordings (unexpected success)");
  } catch (e) {
    const code = e instanceof NapsterError ? e.code : null;
    console.log(code === "RecordingsApiNotEnabled" ? "  OFF   video recordings (request enablement — VHS falls back to the letter)" : `  ok    video recordings enabled (probe answered ${code ?? "error"})`);
  }
}

main();
