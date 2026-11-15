# ADR 0002 — Fully multilingual, one agent per character × locale

**Status:** accepted (2026-11-15, user requirement: "le jeu devra être entièrement multilingue")

**Decision:**
- Every user-facing string is a locale map; active locales are listed in `content/locales.json`; tests fail on any missing translation.
- Each character gets one Napster agent per locale with `language` set (strict lock) and a language directive appended to the instructions.
- Prompts are written once, in any language; they must not fix a language themselves.

**Why:** the agent `language` field is set on the agent and cannot be overridden per connection. Without a lock, the agent defaults to English and can drift when the player mixes languages. Separate agents keep each session in the player's language, and the same companion (face) is reused across them.

**Consequences:** adding a locale = translations + `npm run provision`. Agents count against the 100-per-org limit (2 characters × N locales). Memory is per companion + player, so a player who switches language keeps the same character memory.
