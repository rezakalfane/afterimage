import { requireContext } from "@/server/dal/context";
import { overview } from "@/server/dal/admin";
import { handler, json } from "@/server/security/http";

export const dynamic = "force-dynamic";
export const GET = handler(async (req) => json({ ok: true, ...(await overview(await requireContext(req))) }));
