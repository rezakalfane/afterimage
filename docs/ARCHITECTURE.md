# Architecture

```
Browser (untrusted)                       Next.js route handlers (Node)                    Napster
───────────────────                       ─────────────────────────────                    ───────
Game UI ── button / keyboard ──► POST /api/runs/:id/commands ─┐
        ◄── projected state ──────────────────────────────────┤  requireContext (Better Auth session
                                                              │   + verified membership)
Web SDK ◄═══ WebRTC (video/voice) ═══════════════════════════════════════════════════════► agent
   │ function_implicitly_called                               │  getRun (tenant + id + owner)
   └── POST /api/runs/:id/tool ───────────────────────────────┤  lease of THIS user/run/character
       ◄── output (+ character projection) ── send_function_output                       │
                                                              │  Zod + closed tool list → engine
POST /api/runs/:id/conversation ─► admission tx (quotas, rate slot, one lease/run) ─► POST /public/agents/{id}/connections
                                   (no network inside the tx)          ◄── token (to this browser only)
Cron / ops:cleanup ─► maintenance (lease reconciliation, retention) ─► DELETE /public/connections/{id}
                                   DB: SQLite file (local) · Turso libSQL (staging/production)
```

## Modules

| Path | Role |
|---|---|
| `src/server/world/engine.ts` | Pure deterministic engine (ported from the kit). Commands → new state or a stable refusal code |
| `src/server/world/projections.ts` | `playerView` (no undiscovered document) and `characterContext` (one character's allowed knowledge) |
| `src/server/world/service.ts` | The only mutation path: write tx, idempotency receipt, lease and revision checks, CAS, event, memory facts |
| `src/server/world/ending.ts` | Final choice: intent → single-use, short-lived token → confirmation in the same tx as the decision |
| `src/server/world/rehearsal.ts` | Rehearsal replies (deterministic, server-side, never mutating) |
| `src/server/dal/*` | `TenantContext`, run access (always tenant + id + owner), admin operations |
| `src/server/auth/*` | Better Auth (anonymous plugin, invitation-gated sign-up in `databaseHooks`), onboarding, invitations |
| `src/server/napster/*` | API client, admission/leases/rate slot, connection context, tool definitions (fr + en) |
| `src/server/jobs/maintenance.ts` | Lease reconciliation (incl. creates without response), retention purge, DB lock |
| `src/server/db/*` | Drizzle schema (app + generated Better Auth), libSQL client, local serialized client |
| `src/components/*` | Game UI, conversation controller (`useLiveConversation`), admin |
| `src/content/episodes/last-screening/v1/` | Server-only episode data and immutable agent prompts (fr, en) |

## Invariants and where they are enforced

| Invariant (kit §9) | Enforcement |
|---|---|
| No recovered cache without preserved cache; message recovered = message confirmed | engine prerequisites; message stored once, rendered from the stored value |
| No ending without both readings; only the player confirms | engine + `ending-confirmed` channel reachable only through the single-use token route |
| No shared inventory/knowledge between runs; Malik ≠ Jeanne | per-run snapshot; `characterContext` per character; memory id per run + character |
| No action from an old connection after an era switch | tool route needs the caller's **active** lease for the current era's character; era switch refused while a lease is open |
| No doubled effect on repeated SDK events / retries | client `call_id` dedupe + server `command_receipts` (same id → same result; other payload → 409) |
| No action on behalf of another user | every run query scoped by tenant + owner; 404 for foreign ids |
| No global agent change for one run | run data only via `externalClientProfile`, tool outputs and the player's own `send_message` |

## Local SQLite specifics

The local libSQL driver executes synchronously on a pool of connections. Contention made SQLite's busy handler block the thread and Better Auth's writes fail. Locally (`file:` URLs only) all access goes through **one connection behind an async mutex**, and a guard throws if code calls the client inside an open transaction (no silent deadlock). Remote libSQL is used as is. Local tests prove the application logic (CAS, caps, unique open lease), **not** Turso's behaviour over the network: that must be re-run on staging.
