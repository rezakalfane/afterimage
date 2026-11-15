# AFTERIMAGE — La dernière séance

An interactive mystery for the **Napster API Ignite 2026 hackathon**. Talk by voice to two characters who live in the same cinema thirty years apart: Jeanne, a projectionist in 1996, and Malik, an archivist in 2026. What you convince Jeanne to do changes what Malik finds. Fully multilingual.

## Run it
```bash
npm install
cp .env.example .env      # set NAPSTER_API_KEY
npm run provision         # creates the Napster tools and agents from content/
npm run dev               # http://localhost:3000
```
Requires Node ≥ 22 and a microphone.

## How it uses the Napster API
- Two real-time video agents (WebRTC, Web SDK), one per era, per language.
- Memory across sessions per player (`externalClientId`).
- Implicit tools validated by a server-side canon so 1996 and 2026 stay consistent.
- Recordings API for the VHS tape, with a fallback.

See [docs/](docs/README.md) for architecture and decisions, and [content/README.md](content/README.md) to write the story.

## AI assistance
Built with AI assistance, as allowed and disclosed per the hackathon rules: Claude Code for code, ChatGPT for story and visual concepts. Design decisions, direction and review are the author's.
