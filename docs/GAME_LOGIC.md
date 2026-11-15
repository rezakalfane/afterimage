# Game logic — La dernière séance

How the episode works, generated from the code (`src/server/world/engine.ts`,
`src/server/napster/tools.ts`, `src/content/episodes/last-screening/v1/`). The engine is pure
and authoritative: characters and the player only *propose* actions; the engine accepts or
refuses them. Diagrams use Mermaid (GitHub renders them).

## 1. The story in one picture

Two eras share one projection booth. The player talks with **Jeanne** (1996, the last night
before the cinema closes) and **Malik** (2026, thirty years later). Neither can see the other's
era: the player carries clues between them.

```mermaid
flowchart LR
  subgraph Y2026["2026 — Malik"]
    P[Photo on the desk<br/>back: G7]
    W[Water mark<br/>2008 report]
    FK[Key behind<br/>the projector]
    C26[Crescent cabinet<br/>upper shelf]
    M[Message + Alice's letter]
  end
  subgraph Y1996["1996 — Jeanne"]
    K[Key under seat G7]
    C96[Crescent cabinet]
    L[Alice's letter<br/>+ programme]
    MSG[Player's message]
    S[Store high<br/>upper shelf]
  end
  P -- "player relays G7" --> K --> C96 --> L --> MSG --> S
  W -- "player warns: water" --> S
  S -- "30 years pass" --> FK --> C26 --> M --> E{{Ending:<br/>player decides}}
```

## 2. The three puzzles

| # | Puzzle | Where the clue is | Who acts | What unlocks |
|---|---|---|---|---|
| 1 | **The key** | Back of the photo in 2026: "G7" | Jeanne searches under seat G7 | The 1996 cabinet opens → the letter |
| 2 | **The cache** | Water mark + 2008 report in 2026 (damage at desk level) | Jeanne stores the film on the upper shelf | The film and the message survive 30 years |
| 3 | **The promise** | Alice's letter (1996): the epilogue stays private | Player acknowledges, writes a message, then chooses the ending | Three possible endings |

In 2026, Malik must first find the key **behind the projector** (`find_future_key`); only then can he open the cabinet that Jeanne sealed.

## 3. Dependency graph (flags)

Each box is an engine action; each arrow is a prerequisite flag. Colour = era.

```mermaid
flowchart TD
  classDef y26 fill:#1f3a5f,color:#fff,stroke:#7fb3ff
  classDef y96 fill:#5f3a1f,color:#fff,stroke:#ffc27f
  classDef ui fill:#333,color:#fff,stroke:#ccc,stroke-dasharray:4 3

  inspect_photo[inspect_photo<br/>photo_seen]:::y26
  inspect_waterline[inspect_waterline<br/>waterline_seen]:::y26
  relay_key_location[relay_key_location<br/>key_location_shared]:::y96
  retrieve_key[retrieve_key<br/>key_found]:::y96
  open_cabinet[open_cabinet<br/>cabinet_open]:::y96
  inspect_programme[inspect_programme<br/>programme_seen]:::y96
  read_letter[read_letter<br/>letter_read]:::y96
  acknowledge_permission[acknowledge_permission<br/>permission_acknowledged]:::y96
  relay_flood_warning[relay_flood_warning<br/>flood_warning_shared]:::y96
  write_message[write_message<br/>draft]:::y96
  confirm_message[confirm_message<br/>message_confirmed<br/>UI only]:::ui
  preserve_cache[preserve_cache location=upper_cabinet<br/>cache_preserved]:::y96
  find_future_key[find_future_key<br/>future_key_found]:::y26
  recover_cache[recover_cache<br/>cache_recovered]:::y26
  read_message[read_message<br/>message_read]:::y26
  read_future_letter[read_future_letter<br/>future_letter_read]:::y26
  choose_ending[choose_ending<br/>UI confirmation only]:::ui

  inspect_photo --> relay_key_location --> retrieve_key --> open_cabinet
  open_cabinet --> read_letter
  inspect_programme --> read_letter
  read_letter --> acknowledge_permission
  read_letter --> write_message --> confirm_message
  inspect_waterline --> relay_flood_warning
  open_cabinet --> preserve_cache
  acknowledge_permission --> preserve_cache
  relay_flood_warning --> preserve_cache
  confirm_message --> preserve_cache
  preserve_cache --> find_future_key --> recover_cache
  recover_cache --> read_message --> choose_ending
  recover_cache --> read_future_letter --> choose_ending
```

## 4. Actions: era, prerequisites, effect

| Action | Era | Requires | Sets | Who can trigger |
|---|---|---|---|---|
| `inspect_photo` | 2026 | — | `photo_seen` | UI, Malik |
| `inspect_waterline` | 2026 | — | `waterline_seen` | UI, Malik |
| `relay_key_location` | 1996 | `photo_seen` | `key_location_shared` | UI, Jeanne |
| `retrieve_key` | 1996 | `key_location_shared` | `key_found` | UI, Jeanne |
| `open_cabinet` | 1996 | `key_found` | `cabinet_open` | UI, Jeanne |
| `inspect_programme` | 1996 | — | `programme_seen` | UI, Jeanne |
| `read_letter` | 1996 | `cabinet_open`, `programme_seen` | `letter_read` | UI, Jeanne |
| `acknowledge_permission` | 1996 | `letter_read` | `permission_acknowledged` | UI, Jeanne (player agrees by voice) |
| `relay_flood_warning` | 1996 | `waterline_seen` | `flood_warning_shared` | UI, Jeanne |
| `write_message` | 1996 | `letter_read`, not yet preserved | draft (1–240 chars, normalized) | UI, Jeanne |
| `confirm_message` | 1996 | draft equal to the shown text | `message_confirmed` | **UI only** |
| `preserve_cache` | 1996 | `cabinet_open`, `permission_acknowledged`, `flood_warning_shared`, `message_confirmed` | `cache_preserved` (only `upper_cabinet`; other places → `WRONG_LOCATION`) | UI, Jeanne |
| `find_future_key` | 2026 | `cache_preserved` | `future_key_found` | UI, Malik |
| `recover_cache` | 2026 | `future_key_found` | `cache_recovered` | UI, Malik |
| `read_message` | 2026 | `cache_recovered` | `message_read` | UI, Malik |
| `read_future_letter` | 2026 | `cache_recovered` | `future_letter_read` | UI, Malik |
| `choose_ending` | 2026 | `cache_recovered`, `message_read`, `future_letter_read` | `ending` | **UI confirmation token only** |
| `switch_era` | any | no live conversation open | `activeEra` | **UI only** |
| `request_hint` | any | game not finished | next hint level on the current topic | UI, both characters |

After the message is preserved it is locked (`MESSAGE_LOCKED`): the past cannot be rewritten.

## 5. Phases

```mermaid
stateDiagram-v2
  [*] --> investigate
  investigate --> preserve: cabinet_open (1996)
  preserve --> recover: cache_preserved (1996)
  recover --> decide: cache_recovered (2026)
  decide --> finished: ending confirmed by the player
  finished --> [*]
```

## 6. Refusals (what the character hears)

| Code | When | Text returned (en; fr in `texts.ts`) |
|---|---|---|
| `WRONG_ERA` | The action belongs to the other era | "This action is not possible in this era." |
| `PREREQUISITE_MISSING` | A required flag is missing | A precise, in-character reason (e.g. "the cabinet is locked, no key") |
| `WRONG_LOCATION` | Film stored somewhere other than the upper shelf | Why that place is risky + a suggestion |
| `WRONG_CHARACTER` | Jeanne's tool in 2026, or Malik's in 1996 | "This action cannot come from this character." |
| `UI_CONFIRMATION_REQUIRED` | A model tried to confirm the message, switch era or choose the ending | "You confirm this decision yourself, on screen." |
| `MESSAGE_LOCKED` | Editing the message after it was preserved | "The message is already sealed with the film…" |
| `RUN_FINISHED` | Any action after the ending | — |

## 7. Characters and their tools

The model never sees engine actions directly: each character has a closed list of tools,
validated with Zod and mapped to one engine command. English agents use the same tools
prefixed `en_` with English argument values.

| Tool | Arguments | Engine action |
|---|---|---|
| `jeanne_examine` | `objet: programme \| lettre` | `inspect_programme` / `read_letter` |
| `jeanne_use_clue` | `indice: siege_g7 \| risque_eau` | `relay_key_location` / `relay_flood_warning` |
| `jeanne_act` | `geste: chercher_cle \| ouvrir_armoire \| noter_accord \| conserver`, `emplacement?` | `retrieve_key` / `open_cabinet` / `acknowledge_permission` / `preserve_cache` |
| `jeanne_draft_message` | `texte` | `write_message` |
| `malik_examine` | `objet: photo \| trace_eau \| message \| lettre` | `inspect_photo` / `inspect_waterline` / `read_message` / `read_future_letter` |
| `malik_act` | `geste: chercher_cle \| ouvrir_armoire` | `find_future_key` / `recover_cache` |
| `world_request_hint` | — | `request_hint` |

### What each character knows

| | Jeanne (1996) | Malik (2026) |
|---|---|---|
| At the start | The cinema closes tonight; Alice Mercier's film; she cancelled the screening; a promise to keep; the cabinet holds the film and the letter; she lost the key | 15 Nov 2026; no film for 30 years; the last screening was cancelled; a lost film by Alice; a photo and a water mark on the desk; no key for the cabinet |
| Learned during play | programme → the cancellation was deliberate; letter → a version without the epilogue is allowed; G7 from the player; the water risk from the player | photo → G7; water mark → 2008 damage at desk level; after 1996 preservation → "a new object is detectable"; key behind the projector; reel, envelope and message |
| Never knows | G7 before the player says it; the future | What happened in 1996 until it is in the cabinet |

Knowledge is projected per character (`characterContext`) and sent only through
`externalClientProfile`, tool outputs and system messages. The agents' global prompts never
contain player data.

## 8. Endings

| Ending | Choice | Promise to Alice |
|---|---|---|
| `public_cut` | Screen the authorised version (no epilogue) | Kept |
| `sealed_archive` | Entrust the film to the archives, no screening | Kept |
| `broken_promise` | Screen everything despite the letter | Broken (its confirmation states the betrayal) |

The ending is chosen in the UI, then confirmed with a single-use token
(`ending-intent` → `ending`). A character can talk about the choice but never make it.

## 9. Hints

Three levels per topic, requested by the player (button or by voice). The topic follows the
progress:

| Situation | Topic |
|---|---|
| The 1996 cabinet is still closed | `key` |
| Letter not read or permission not acknowledged | `promise` |
| Cache not preserved yet | `cache` |
| Afterwards | `promise` |

## 10. One action, end to end

```mermaid
sequenceDiagram
  participant P as Player
  participant A as Napster agent (Jeanne/Malik)
  participant B as Browser (Web SDK)
  participant S as Server (/api/runs/:id/tool)
  participant E as Engine + DB (one write transaction)
  P->>A: "Look under seat G7!"
  A->>B: function_implicitly_called jeanne_use_clue(siege_g7)
  B->>S: POST tool {callId, name, args, leaseId}
  S->>S: auth · ownership · lease · Zod · tool→command
  S->>E: executeCommand (CAS revision, receipt, event)
  E-->>S: accepted, new state
  S-->>B: output {result, context, outilsMaintenant}
  B->>A: send_function_output (delay: true)
  A->>P: in character: "G7… I'll look." 
  B->>B: scene and notebook refresh from the projection
```

Napster is never called inside the transaction; a repeated `callId` returns the stored
receipt instead of acting twice.
