# ADR 0003 — Implicit tools and a server-side canon

**Status:** accepted (2026-11-15)

**Decision:** character actions are implicit tools. The browser forwards each call to `/api/world/tool`, where pure functions in `src/lib/world/world.ts` decide the outcome. The agent speaks from the returned output and never decides facts.

**Why:** implicit tools work locally with no public URL, and keep a single authority for what is true in each era, which is the hardest part of a two-timeline story with LLM characters.

**Alternatives kept for later:** an explicit WebSocket tool server (`wss://`) would add `receiveMessages` (a live transcript feed), `ui_update` and `context_update` (for example, Malik reacting the moment the past changes). It needs a public WebSocket endpoint; consider it once the app is deployed.
