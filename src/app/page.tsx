import { headers } from "next/headers";
import { HomeClient } from "@/components/home/HomeClient";
import { contextFromHeaders } from "@/server/dal/context";
import { listRuns } from "@/server/dal/runs";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  let runs: { id: string; status: string; updatedAt: number }[] = [];
  let signedIn = false;
  let role: string | null = null;
  try {
    const ctx = await contextFromHeaders(await headers());
    signedIn = true;
    role = ctx.role;
    runs = await listRuns(ctx);
  } catch {
    /* not signed in yet: "Commencer" creates a guest session */
  }
  return <HomeClient mode={env().CONVERSATION_MODE} runs={runs} signedIn={signedIn} isAdmin={role === "owner" || role === "admin"} />;
}
