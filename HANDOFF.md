# HANDOFF

## Where we are (2026-11-15)
| Phase | State |
|---|---|
| Repo scaffold (Next.js, SDK, tests, docs) | done |
| Canon guardian (1996 ↔ 2026) + tests | done (18 tests) |
| Multilingual base (fr, en) | done |
| Napster provisioning (3 tools, 4 agents, stock avatars as stand-ins) | done, live on the account |
| Live voice call in a browser | **not yet tested by a human** |
| Persistent world store | todo (blocks deployment) |
| Custom avatars for Jeanne & Malik | waiting for portraits from the scenario team |
| VHS tape (Recordings API) | code ready; feature **not enabled** on the org (403) → letter fallback |
| Final story, prompts, scenes | scenario team (ChatGPT + user) |
| Deploy to Vercel, phone call (VoIP) | todo |

## Verified at handoff
- `npm run verify` → typecheck ok, 18/18 tests, production build ok.
- `npm run provision` → created tools `cacher_bobine`, `laisser_message`, `fouiller` and agents jeanne/fr, jeanne/en, malik/fr, malik/en.
- Dev server + curl: `/` redirects by Accept-Language, `/fr` 200, `/de` 404; tool chain hide → message → search returns the reel and the message; `/api/session` returns a token (session then closed from the backend); `/api/vhs` reports the letter fallback.

## Resume in 5 commands
```bash
npm install
cp .env.example .env   # then set NAPSTER_API_KEY
npm run check-key
npm run verify
npm run dev            # open http://localhost:3000, click "Appeler Jeanne"
```

## Next steps (in order)
1. Talk to Jeanne and Malik in the browser (fr and en): check voice, tool calls, subtitles, memory on a second call.
2. Replace `MemoryStore` with a persistent store (Vercel Marketplace), then deploy to Vercel (preview), set `NAPSTER_API_KEY` in the project env.
3. When portraits arrive: put them in `public/characters/`, set `companion.picture`, set `PUBLIC_BASE_URL` to the deployed URL, `npm run provision`.
4. Integrate the scenario team's story: prompts, locations, scenes, items. Re-provision.
5. Once Recordings is enabled: run `npm run check-key`, measure render time, tune when the tape is requested.
6. Phone call to Jeanne in 2026 (VoIP channel + Twilio number), Edge MCP hotspots in the scene, then polish and the demo video.

## Things to know
- **Commits in the user's name only** (sole-author hackathon rule). No AI trailers.
- Web SDK v2.0.0 ≠ online docs (see `docs/01-ARCHITECTURE.md`). Trust `node_modules/@touchcastllc/napster-companion-api/lib/types/index.d.ts`.
- Function IDs equal their names.
- Connection endpoints: 1 request/s per key, so tests that open sessions back-to-back hit 429.
- A WebSocket session opened but never joined can't always be deleted; it expires as `not_started`.
- Recordings enablement message is ready to send (org ID is in the dashboard URL).
- `typescript@7` is installed (native compiler); Next 16 builds with it.

## Key files
`content/` · `scripts/provision.ts` · `src/lib/world/world.ts` · `src/app/api/` · `src/components/CharacterCall.tsx` · `src/i18n/ui.ts` · `src/generated/napster-ids.json`
