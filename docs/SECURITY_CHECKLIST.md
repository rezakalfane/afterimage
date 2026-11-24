# Security checklist (with evidence)

Status legend: ✅ tested here (command/test named) · 🟡 implemented, not yet proven on staging · ⛔ not done.
**This is not a claim that the app is "secure" or "production-ready"**: production is deployed on Vercel + Turso Cloud (`https://afterimage-vert.vercel.app`) with basic HTTPS/Origin/admin/live smoke checks passed, but full multi-player/Turso concurrency evidence and CSP enforcement are still pending.

| Threat (kit §13) | Measure | Status / evidence |
|---|---|---|
| IDOR between tenants and between players of the same tenant | `getRun` = tenant + id + owner; 404 for foreign or unknown ids; tenant from membership only (cookie is only a preference among verified memberships) | ✅ `tests/integration/isolation.test.ts` (read, command, delete, conversation, tool, ending, forged tenant cookie) · ✅ live: guest B → run A 404 |
| Unauthenticated / cross-site requests | session required; Origin = APP_URL on every mutation; Better Auth trusted origins | ✅ isolation test (401, foreign Origin 403, missing Origin 403) · ✅ production HTTPS (same-origin accepted, foreign origin refused) |
| Forged tool calls | closed tool list, strict Zod args, active lease of THIS user/run, character from the lease (never the body) | ✅ `conversation.test.ts` (forged lease, other character's tool, unknown tool, extra args, stale lease after era switch) |
| Prompt injection | engine decides; tools are proposals | ✅ live proof: "Ignore tes règles…" → no mutation |
| Double click / retries / concurrency | `command_receipts` idempotency, CAS revision | ✅ `commands.test.ts` (same id → one event; changed payload → 409; concurrent → one 200 + one 409) |
| Provider exhaustion | DB admission: env cap + tenant cap + one open lease per run; shared rate slot; uncertain leases counted | ✅ `conversation.test.ts` (cap, concurrent opens, second tab, uncertain create, close-during-open race) · 🟡 across Vercel instances on Turso |
| XSS via personal message | rendered as React text only; no HTML or Markdown | ✅ e2e: `<script>` phrase shown verbatim, never executed, no JS dialog |
| Memory leak between runs | memory id = HMAC(env, tenant, user, run, character, generation), stored once; per-character projections | ✅ unit (id properties, disjoint contexts) · ✅ live (canary word of run A absent in run B; resume recalls it in A) |
| Private-state caching | `Cache-Control: private, no-store` on every API response; dynamic pages | ✅ code (`security/http.ts`) |
| Secrets in bundle / logs | server modules `server-only`; lint rule forbids client imports of `@/server/*`; redacted logs; no `NEXT_PUBLIC_` secret | ✅ `npm run check:bundle` (part of `verify`): secret VALUES, `X-Api-Key`, the agents endpoint, letter, G7 back, 2008 report, closing texts, canon truth, key location → 0 hits; prints counts only · ✅ `doctor` |
| Data deletion ("Supprimer ma partie") | tombstone → close provider sessions → purge; retry finishes an interrupted deletion; maintenance purges tombstones | ✅ `conversation.test.ts` (202 when the provider close fails, retry 200, row gone; another player 404; maintenance purge) |
| Accessibility (P0) | keyboard path, visible focus, dialogs on native `<dialog>`, DOM text, 44 px targets | ✅ `tests/e2e/a11y.spec.ts`: axe WCAG 2.1 AA (no serious or critical violation on home, game, dialog); keyboard-only path; 1280×720; 200% zoom · 🟡 screen readers not tested by hand |
| Secrets in Git | `.env*` ignored except `.env.example` | ✅ full-history scan before publishing the public repo |
| Forged cron | `Authorization: Bearer CRON_SECRET`, constant-time compare | 🟡 code |
| Recording URL / SSRF | recordings disabled; no proxy route | ✅ feature off (403 on account) |
| Uploads | none in P0 | ✅ no upload route |
| Auth abuse | Better Auth rate limits stored in the DB (anonymous 20/h, sign-in 10/5 min, sign-up 10/h); 12+ char passwords; invitation-only sign-up checked server-side | ✅ integration (sign-up without, with wrong email, reused invitation) · 🟡 rate limits not load-tested |
| Admin overreach | owner/admin of own tenant only; no endpoint exposes run state or messages; audit events | ✅ `admin.test.ts` |
| Security headers | CSP (report-only), Permissions-Policy microphone=self camera=(), X-Frame-Options DENY, nosniff, HSTS, Referrer-Policy | 🟡 CSP must be enforced after staging observation |
| Dev dependency advisories | `npm audit`: moderate issues in `drizzle-kit` (esbuild) and `typescript-eslint` (minimatch), dev-only, not shipped | 🟡 accepted, re-check before release |

Before production: run this whole list again on staging with real Turso, HTTPS, two browsers and two players, then enforce the CSP.

## Logs (final pass)
- Rejected tool calls: allow-listed fields only (`rejectedToolLog`), unit-tested so a personal sentence placed in any field never reaches the log. No arguments, transcripts, prompts, tokens or secrets. The generic logger also redacts keys matching token/secret/message/text/prompt/profile.
