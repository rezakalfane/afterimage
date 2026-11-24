# HANDOFF

## Where we are (2026-11-15)

| Lot (kit §19) | State |
|---|---|
| 0 Accès | ✅ capability matrix, live proofs (docs/NAPSTER_ACCESS_REPORT.md), 4 agents documented and reused (fr = P0; en = 100% English, P1) |
| 1 Fondation | ✅ setup/doctor/migrate/seed, env schema, lint, typecheck |
| 2 Identités | ✅ Better Auth (guest + invitation), memberships, DAL; A/B isolation tested (same tenant and cross tenant) |
| 3 Monde | ✅ engine, projections, transactions, CAS, idempotency, 3 endings |
| 4 Interface | ✅ full chapter in rehearsal mode, desktop and mobile (e2e) |
| 5 Napster | ✅ live in the real game (tools, mutations, reactions, era switch), admission, teardown |
| 6 Mémoire | ✅ HMAC identity per run and character; no contamination (live canary); resume recalls |
| 7 Signature | ✅ exact sentence end to end; no video generation required |
| 8 Résilience | ✅ reload, network cut, retries, uncertain creates, close-during-open race, 429, maintenance |
| 9 Finition | 🟡 finishing pass done (brief v2: layout, identity, objects, inspections, message, epilogue, menu); captures in var/screens/before|after (`SCREENS_DIR=… npx playwright test --project=capture`); not done: ambient sound, VoiceOver pass, 3-person playtest |
| 10 Release | 🟡 production live at https://afterimage-vert.vercel.app (Vercel + Turso Cloud, one project, no staging); remaining: GitHub link, full acceptance, CSP review |
| 11 Bonus | ⛔ off (Recordings 403; phone untested). Companion V2: ✅ adopted on the 4 agents (V1 kept as fallback in `companionsV1`) |
| 12 Soumission | 🟡 README; the video is still to record |

## Verified at handoff
- `npm run verify` → lint ✓, typecheck ✓, unit 30/30, integration 22/22, build ✓, bundle check ✓.
- `npx playwright test` → 13/13 on a production build: three endings, reload/offline, hints, era-switch subtitles, English (Settings → English → back to French), mobile 390 px, axe WCAG AA, keyboard only, 1280×720, 200% zoom, screens.
- Napster functions re-provisioned for fr and en (2026-11-15) after the `malik_act` change (key behind the projector).
- `node tests/live/game-live.mjs` → full live path OK (Malik's tool, era switch, Jeanne finds the key). Napster spend so far: **$1.28** of $150.
- Clean clone from GitHub: `npm ci && npm run setup && npm run dev` → a guest run is playable.

## Resume in 5 commands
```bash
npm ci
npm run setup            # or keep the existing .env.local
npm run doctor
npm run verify && npx playwright test
npm run dev
```

## Next steps (in order)
1. Production follow-ups on [afterimage-vert.vercel.app](https://afterimage-vert.vercel.app): link GitHub repo on Vercel (needs GitHub Login Connection), full HTTPS acceptance (English live, 3 endings live, two tabs / two players, Safari), CSP report review, DB restore rehearsal.
2. Live check of an English session on production (a few cents).
3. Optional polish: ambient sound levels / echo check, more scene transitions, a demo video.
4. Bonuses only after enablement: Recordings (VHS) and the phone epilogue.

## Things to know
- Commit as the user only (no AI trailers). Public repo: github.com/rezakalfane/afterimage.
- Local DB = one connection behind a mutex (`serialized-client.ts`). Remote libSQL is untouched and must be validated on Turso.
- Napster counts request arrivals: rate slot 1.5 s, one retry on 429.
- E2E uses port 3197 (3100 is used by another local project). Never log the dev server into `var/` (reload loop).
- Agent ids: `config/napster-resources.json`. `provision:napster` is a dry run unless `--apply`, and refuses while sessions are open.
