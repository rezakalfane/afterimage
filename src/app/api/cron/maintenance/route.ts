// Vercel Cron → maintenance. Authenticated by CRON_SECRET (Authorization: Bearer …), constant-time compare.
import { env } from "@/server/env";
import { runMaintenance } from "@/server/jobs/maintenance";
import { safeEqual } from "@/server/security/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${env().CRON_SECRET}`)) return new Response(null, { status: 401 });
  return Response.json(await runMaintenance(), { headers: { "Cache-Control": "no-store" } });
}
