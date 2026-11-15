# 01 — Architecture

```
Browser (Next.js page /[locale])                Server (Next.js route handlers)            Napster API
───────────────────────────────                 ───────────────────────────────            ───────────
Game ── era switch, scene, inventory
 └─ CharacterCall (Web SDK, WebRTC) ── getToken ──► POST /api/session ───────────────────► POST /public/agents/{id}/connections
      │                                              (player cookie = externalClientId,     (agent per character × locale)
      │                                               faits_etablis from the canon)
      │◄── function_implicitly_called ─────────────────────────────────────────────────── agent decides to use a tool
      ├──► POST /api/world/tool ───────────────────► canon guardian (src/lib/world) ── after(): POST /recordings (VHS)
      │◄── { output, events, view }
      └──► send_function_output ──────────────────────────────────────────────────────────► agent continues
 VhsPlayer ── poll ──────────────────────────────► GET /api/vhs ───────────────────────────► GET /recordings/{id}, download-url
```

## Pieces
| Path | Role |
|---|---|
| `content/` | Story, characters, locations, locales (owned by the scenario team) |
| `scripts/provision.ts` | content → Napster tools, companions, agents (idempotent); writes `src/generated/napster-ids.json` |
| `src/lib/world/world.ts` | **Canon guardian**: pure state transitions (`hideReel`, `leaveMessage`, `search`), what each character may know (`factsFor`), timeline changes |
| `src/lib/world/store.ts` | World persistence per player. **In-memory only — must be replaced by a persistent store before deploying** (Vercel instances don't share memory) |
| `src/lib/napster/api.ts` | Server-only API client, 429 retry with `Retry-After` |
| `src/lib/vhs.ts` | Recordings API request/poll, letter fallback on `RecordingsApiNotEnabled` |
| `src/app/api/*` | `session` (token), `world` (view, new game), `world/tool` (tool calls), `vhs` (tape) |
| `src/components/` | `Game`, `CharacterCall` (Web SDK), `VhsPlayer` |
| `src/i18n/ui.ts` | Interface strings per locale |

## How the two eras stay consistent
1. Jeanne's tools (`cacher_bobine`, `laisser_message`) and Malik's (`fouiller`) are **implicit**: the browser forwards each call to `/api/world/tool`; the canon decides and returns the output the agent must speak from.
2. Each session starts with `externalClientProfile.faits_etablis`, the facts that character may know. Jeanne never receives anything about 2026; Malik only what he has found in the current timeline.
3. Re-hiding the reel after Malik found it bumps `timeline`, clears his finds and emits `timeline_changed` ("Le passé a changé le présent").
4. Prompts carry the behavioural rules (when to call tools, never invent finds). Provisioning appends the location list and the language directive.

## Multilingual
See ADR 0002. One agent per (character, locale), `language` locked, instructions end with "Always speak <language>". `/` redirects by `Accept-Language`; `/[locale]` renders the game; the language select switches locale (and remounts the call on the matching agent).

## Verified API facts (2026-11-15, with the project key)
- Auth, stock catalog (2,540 companions, some v1+v2), agent create/patch/delete, WebRTC and WebSocket connections, backend `DELETE /public/connections/{id}`, VoIP channel config: **work**.
- Function IDs are the function **names** (`POST /public/functions` returns `id: "cacher_bobine"`).
- Recordings: **403 `RecordingsApiNotEnabled`** — enablement requested from Napster; fallback active.
- v2 avatars on custom companions: unverified.
- **Web SDK 2.0.0 differs from the online docs**: `init(getToken: () => Promise<string>, config)` takes a token *function*, the SDK runs the mic prompt itself, placement is `layout: { type: "inline", mountContainer }`, the shape is `style: { view }`. `onSessionStatusChange` reports `readyAudio` / `readyVideo` / `permissionBlocked`.

## Limits that shape the design
5 concurrent WebRTC sessions per org · 1 connection request/s per key · 10 s tool timeout · 3 min idle timeout · Recordings text 84–30,000 chars, async render · 100 agents per org (2 characters × N locales).
