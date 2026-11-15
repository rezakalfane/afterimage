import Link from "next/link";
import { headers } from "next/headers";
import { GameShell } from "@/components/game/GameShell";
import type { PublicState } from "@/components/game/types";
import { contextFromHeaders } from "@/server/dal/context";
import { getRun } from "@/server/dal/runs";
import { env } from "@/server/env";
import { HttpError } from "@/server/security/http";
import { playerView } from "@/server/world/projections";

export const dynamic = "force-dynamic";
export const metadata = { title: "La cabine — AFTERIMAGE" };

export default async function PlayPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  let data: { id: string; initial: PublicState } | null = null;
  let unauth = false;
  try {
    const ctx = await contextFromHeaders(await headers());
    const run = await getRun(ctx, runId);
    // Only the player projection is serialized to the client (no bible, no private canon).
    data = { id: run.id, initial: playerView(run.state) as unknown as PublicState };
  } catch (e) {
    unauth = e instanceof HttpError && e.code === "UNAUTHENTICATED";
    if (!(e instanceof HttpError)) throw e;
  }
  if (data) return <GameShell runId={data.id} mode={env().CONVERSATION_MODE} initial={data.initial} />;
  return (
    <main className="page page--center">
      <h1>{unauth ? "Votre session a expiré" : "Partie introuvable"}</h1>
      <p>{unauth ? "Reprenez depuis l’accueil." : "Cette partie n’existe pas ou ne vous appartient pas."}</p>
      <Link className="btn btn--brass" href="/">Retour à l’accueil</Link>
    </main>
  );
}
