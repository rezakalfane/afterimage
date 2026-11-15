# AGENTS.md — AFTERIMAGE

Rules every coding session follows. Keep this file short: rules, not history.

## Start here
1. Read `HANDOFF.md` (where we are, next steps).
2. Read `docs/README.md` (ordered index; each doc is the source of truth for its topic).
3. Content lives in `content/` (see `content/README.md`). Story text never goes in `src/`.

## Scope guard
- Build only what is asked. Ask before changing the stack: **Next.js 16 App Router, React 19, TypeScript strict, Napster Web SDK `@touchcastllc/napster-companion-api` v2, Vitest, Node ≥ 22**, hosted on Vercel.
- The hackathon entry has a **single author** (the user). Commits use the user's identity only: **no `Co-Authored-By` or "Generated with" lines**. AI assistance is disclosed in the README / submission writeup instead.
- Publishing, deploying to production, repo visibility and anything that spends credits are the user's decisions.
- Napster API facts not verified against the live API stay marked as unverified in the docs. The installed SDK's `.d.ts` beats the online docs (v2 changed `init`, see `docs/architecture.md`).

## Commands
| Command | What |
|---|---|
| `npm run verify` | typecheck + tests + production build. Must be green before a commit. |
| `npm test` | Vitest (canon logic + translation completeness) |
| `npx vitest run src/lib/world` | one test folder |
| `npm run dev` | local app on :3000 |
| `npm run provision` (`-- --dry`) | push `content/` to Napster: tools, companions, one agent per character × locale. Rewrites `src/generated/napster-ids.json` (commit it). Run after changing characters, prompts, locations or locales. |
| `npm run check-key` | read-only check of what the API key can do |

## Single sources of truth
- **Canon** (what happened in 1996 / exists in 2026): `src/lib/world/world.ts`, pure functions. Agents never decide outcomes; tools ask the canon.
- **Content**: `content/*.json`, `content/characters/*.prompt.md`.
- **UI strings**: `src/i18n/ui.ts`.
- **Napster IDs**: `src/generated/napster-ids.json`, generated, never hand-edited.

## Contracts
- **Fully multilingual.** Every user-facing string is a `{ "<locale>": "…" }` map with all active locales (`content/locales.json`); tests fail otherwise. Agents are per (character, locale) with a strict `language` lock. Never hard-code copy in components.
- The API key stays server-side (`src/lib/napster/api.ts`, route handlers, scripts). The browser only gets short-lived tokens.
- Tools are **implicit**: browser receives `function_implicitly_called` → POST `/api/world/tool` → `send_function_output`. Dedupe by `call_id`. Answer within 10 s.
- One live WebRTC session per player at a time (org limit: 5 concurrent per transport). Switching era unmounts the call.
- `externalClientId` = the player cookie id (`^[A-Za-z0-9_-]{1,32}$`); it is what makes characters remember the player. "New game" mints a new id.
- Connection endpoints are limited to 1 request/s per key: go through `napster()` which honours `Retry-After`.

## UI and tone
- Placeholder visuals; art direction comes from the scenario team's mockups. Colors from CSS tokens in `globals.css`.
- Error messages say what happened and what to do, in the player's language.
- Only fictional, generated faces and voices. Never a real person's likeness.

## Definition of done
`npm run verify` green · the flow was exercised (routes with curl or a browser call) · touched docs updated · a `HISTORY.md` entry · commit in the user's name.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
