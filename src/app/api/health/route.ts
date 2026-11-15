// Liveness only: no configuration, version or dependency details.
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
