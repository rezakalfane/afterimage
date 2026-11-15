# ADR 0001 — Stack

**Status:** accepted (2026-11-15)

**Decision:** Next.js 16 (App Router) + React 19 + TypeScript strict, Napster Web SDK v2 over WebRTC, Vitest, hosted on Vercel.

**Why:** the hackathon needs a hosted demo judges can open with no setup. One Next.js app holds both the browser game and the server routes that keep the API key secret and run the canon logic. Vercel gives preview URLs per push.

**Consequences:** route handlers are serverless, so world state needs a persistent store before deployment (the in-memory store is dev-only).
