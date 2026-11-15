# Decisions and deviations from the kit

## Engine changes vs `docs/kit/world-engine.mjs` (canon preserved)
1. **Wrong hiding place**: `preserve_cache` accepts `upper_cabinet | lower_cabinet | desk | floor`. A wrong place returns `WRONG_LOCATION` with the place, which the controller turns into a precise reason and a suggestion. The kit returned `INVALID_ARGUMENT` (kit §4: "refusé avec une raison précise").
2. **Hints per puzzle**: `hintLevels {key, cache, promise}` (three levels each, kit §7 table) plus a total `hintsUsed`. The kit had a single counter capped at 3.
3. **Tool channel**: `request_hint` and `acknowledge_permission` are allowed from the character's tools (the player may ask or agree by voice). `switch_era` and `confirm_message` are UI-only. `choose_ending` is reachable only through `ending-confirmed`, and an `ending-confirmed` context cannot run anything else.
4. **Message normalization**: NFC, CRLF→LF, trim; 1–240 code points; control characters and bidi overrides refused. The stored value is shown back before confirmation.
5. **Preserving twice** is an idempotent no-op instead of a refusal.
6. **The 2026 key is found before the cabinet opens**: new action `find_future_key` (2026, requires `cache_preserved`, sets `future_key_found`, the key is behind the projector). `recover_cache` now requires `future_key_found`. In playtests Malik opened the cabinet without any key, which broke the symmetry with Jeanne's G7 puzzle. Malik's tool `malik_act` takes `geste: chercher_cle | ouvrir_armoire` (en `gesture: look_for_key | open_cabinet`).

## Kit inconsistencies fixed
- `characters.json` → Jeanne `initialKnown` contained "elle ignore qu'elle est sous G7", which leaked G7 into Jeanne's context and contradicted her `unknown` list ("G7 avant transmission"). It now reads "Elle a égaré la clé et ignore où elle se trouve."
- Schema: `invitations.role` also allows `owner`, only for the CLI bootstrap invitation (the kit forbids a public `/setup` route). Added `ending_intents` (single-use confirmation tokens). Leases carry `user_id` and `external_client_id` for ownership checks and reconciliation.

## Architecture choices
- **Mutations use raw parameterized SQL in `client.transaction("write")`**, because Drizzle's libSQL transaction ignores the mode. Drizzle is used for the schema, migrations and Better Auth.
- **Implicit tools only.** The browser relays tool calls to `/api/runs/:id/tool` and the server re-validates everything. Not used: WebSocket tool servers (`ui_update`, `context_update`), because they need a public `wss://` endpoint (kit §11).
- **Context injection**: `externalClientProfile` at connection time. After a UI mutation while live, the browser sends a `send_message` with `role: system` carrying the new projection (documented commands). Tool outputs carry it too. Tested live: Jeanne reacts to a clue relayed from the UI.
- **Agents**: the 4 existing agents are reused and none is created. `fr` = P0 for every environment, `en` = P1. Environment isolation comes from the memory identity HMAC and separate databases.
- **Capacity**: DB leases plus one shared rate slot (1.5 s, because Napster counts request arrivals) for create and delete. One safe retry on 429 (not created). Expired leases count as `uncertain` until reconciled. When capacity looks full, the open route reconciles once before refusing.
- **SDK 2.0.0** differs from the online docs (token function, `layout`/`style` objects, SDK-managed mic prompt). The code follows the installed `.d.ts`.
- **E2E on a production build**: cold dev compiles crashed or timed out the headless browser.
- **Tool outputs state the next usable tools** (`outilsMaintenant`): live runs showed the model repeating a no-op tool and then concluding it could not act.
- **Migration 0001 is hand-written** (`ALTER TABLE … ADD COLUMN`): drizzle-kit generated a table rebuild that selected the not-yet-existing column.
- **Fonts**: Cormorant Garamond and Source Sans 3 via `next/font`, downloaded at build and self-hosted (SIL OFL 1.1).

## Known gaps (not hidden)
- **Multilingual**: French and English are both active. UI strings live in `src/i18n/messages.ts`; the episode's English content is in `src/content/episodes/last-screening/v1/i18n.en.ts`; server texts, prompts, tools and rehearsal replies are keyed by locale. The player picks the language in Settings (home) or with the FR|EN switch (top bar); the choice is a cookie and the page reloads; the run state is language-free, so the game continues where it was. Leases store the session locale, so a live session keeps its agent's language. Still French only: the admin and privacy pages. The English texts need a native review.
- Second tab: a second tab gets `CONVERSATION_ACTIVE` (read-only use of the scene still works). There is no explicit "take over" button yet.
- The `en` prompts are my translation of the kit and need a native review.
- CSP is report-only until the Napster media/signalling domains are observed on staging (kit §18.9).
- Turso concurrency, backups and restores are untested: no Turso access yet.
