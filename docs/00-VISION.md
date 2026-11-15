# 00 — Vision

**AFTERIMAGE — La dernière séance.** An interactive mystery, halfway between an escape game and an interactive film. The player talks freely, by voice, to two characters who live in the same cinema thirty years apart: Jeanne, a projectionist in 1996, and Malik, an archivist in 2026. They appear as video calls, answer, and remember the player. The player is their only link: convincing Jeanne to hide a reel or leave a message changes what Malik finds thirty years later.

## Why it fits the Napster API
- **Memory is the gameplay**: the same player is remembered by each character across sessions (`externalClientId`).
- **Two live video avatars** with distinct voices and personalities, in many languages.
- **Tools** turn conversation into world changes, validated by a canon server so the two eras stay consistent.
- **Pre-recorded video** (Recordings API): Malik finds a VHS tape where Jeanne speaks the message the player dictated, with her face and voice. *Pending enablement; falls back to a letter.*
- Planned: an inbound phone call (VoIP via Twilio) to Jeanne in 2026, from a number written on the photograph.

## Hackathon (Napster API Ignite 2026)
- Deadline **2026-11-30 23:59 PT**. Required: hosted demo usable without setup, ≤ 3 min video, repo, ≤ 500-word writeup.
- Judging: Use of the Napster API 30 % · Technical execution 25 % · Creativity 25 % · Presentation 20 %.
- Business angle for the writeup: an interactive narrative engine for film heritage, museums and film launches.

## Scope for the entry
One polished chapter of about 10 minutes, fully multilingual, rather than a full game.
