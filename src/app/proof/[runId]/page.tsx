// Technical proof page (LOCAL ONLY): exercises the real live path for automated tests.
import { notFound } from "next/navigation";
import { ProofClient } from "./ProofClient";

export const dynamic = "force-dynamic";

export default async function ProofPage({ params }: { params: Promise<{ runId: string }> }) {
  if (process.env.APP_ENV !== "local") notFound();
  return <ProofClient runId={(await params).runId} />;
}
