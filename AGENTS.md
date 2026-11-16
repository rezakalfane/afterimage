# AGENTS.md — AFTERIMAGE

Rules for every coding session. Rules here, history in HISTORY.md, state in HANDOFF.md.

## Start here
1. `HANDOFF.md` (where we are, next steps), then `docs/README.md`.
2. The canon and product spec are in `docs/kit/AFTERIMAGE_MASTER.md`. Server episode data is in `src/content/episodes/last-screening/v1/` and is never imported from a client component.

## Scope guard
- Stack (ask before changing it): Next.js 16 App Router (Node runtime), React 19, TypeScript 6 strict, Drizzle + `@libsql/client` (SQLite locally, Turso libSQL remotely), Better Auth 1.7 (anonymous + invitation-only sign-up), Napster Web SDK 2.0.0, Zod 4, Vitest 5, Playwright. Versions are pinned exactly; keep the lockfile.
- **Single-author hackathon entry**: commit as the user only. No `Co-Authored-By` or "Generated with" trailers. AI assistance is disclosed in the README.
- Deploying, creating cloud resources, publishing and spending are the user's decisions (see docs/OPERATIONS.md §0). Napster budget: $150 max, warn at $100, keep about $30 for the final run (`npm run ops:napster-usage`); close sessions after every test.
- Never invent a Napster endpoint, field or SDK method. The installed SDK `.d.ts` beats the online docs.

## Commands
`npm run verify` (lint, typecheck, unit, integration, build) must be green before a commit. `npm run test:e2e` runs on a production build. `npm run doctor`. Live proofs (`tests/live/*.mjs`) consume credits: run them only when needed, with a dev server in live mode. Never redirect server logs into the project folder: the dev watcher reloads in a loop.

## Non-negotiables (from the kit)
- The server engine decides; the model only proposes. Every mutation goes through `executeCommand` (auth, membership, ownership, Zod, lease, prerequisites) in one write transaction with CAS, event and idempotency receipt. Napster is never called inside a transaction.
- Every run query is scoped by tenant + id + owner. Return 404 for foreign ids.
- Agents' global prompts are immutable and contain no player data. Run data travels only through `externalClientProfile`, tool outputs and the player's own `send_message`.
- Only the player confirms the message and the ending (UI channel, single-use token). The player may do it by voice: the browser matches the PLAYER's own transcript (never the model's words) while the confirmation is on screen, then sends the same UI command as the button.
- Personal text is rendered as React text, never as HTML.
- No undiscovered canon in client code or responses: hotspot and button labels must not reveal G7, the epilogue or the key location.
- One live avatar per run; capacity in the DB, never in process memory.
- Bonuses (VHS recordings, phone) stay off until proven on the account. Companion V2 is proven and in use (V1 kept as fallback).
- Multilingual structure: server texts, prompts and tools are keyed by locale (fr complete, en agents ready). Do not hard-code new game copy in server modules without a locale entry.

## Definition of done
`verify` green · the flow exercised (e2e and, when the live path changes, a live smoke test) · touched docs updated · a HISTORY.md entry · commit in the user's name.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
