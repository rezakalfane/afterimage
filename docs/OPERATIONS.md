# Operations: deploy, migrate, back up, roll back

**Status**: **production is live** at [https://afterimage-vert.vercel.app](https://afterimage-vert.vercel.app) (Vercel project `afterimage`, team scope; Turso Cloud database `afterimage-db` via the Vercel Marketplace integration; Next.js 16.4.6; Napster live mode with `NAPSTER_MAX_ACTIVE=3`; all migrations + seed applied; owner bootstrapped; HTTPS and live smoke tests `game-live.mjs` and `pixo-live.mjs` passed). There is no separate staging project yet. Remaining: GitHub repo link on Vercel (requires a GitHub Login Connection), full HTTPS acceptance (English live, 3 endings live, 2 tabs / 2 players, Safari), CSP report review before enforcing, and a DB restore rehearsal. Check the CLI syntax against the current Vercel and Turso docs before running it: both CLIs evolve. The Vercel CLI installed here is 56.3.1; the latest is 65.x (`npm i -g vercel@latest`).

## 0. Accesses and decisions needed (by the account owner)

| Need | Why | Who |
|---|---|---|
| A **Turso** account (free plan is enough for the demo), Turso CLI (`brew install tursodatabase/tap/turso`), `turso auth login` | two libSQL databases: staging + production | owner |
| Approval to create **two Vercel projects** (`afterimage-staging`, `afterimage`) linked to `rezakalfane/afterimage` | separate env vars and domains | owner |
| Capacity split of the Napster org limit (5 WebRTC sessions) | production 3, staging 1, local 1 recommended | owner |
| Domain (optional) | otherwise `*.vercel.app` | owner |
| Keep the Napster credit budget: $150 max, warn at $100, about $30 kept for final acceptance and demo | spend tracking (`npm run ops:napster-usage`) | agreed |

## 1. Databases (Turso libSQL)

```bash
turso db create afterimage-staging
turso db create afterimage-prod
turso db show afterimage-staging --url        # libsql://…
turso db tokens create afterimage-staging      # DATABASE_AUTH_TOKEN (staging only)
turso db show afterimage-prod --url
turso db tokens create afterimage-prod         # a different token
```

Use one database per environment. Never put a SQLite file on Vercel (`env.ts` refuses `file:` outside local/test). Confirm that the chosen Turso database type speaks **libSQL** with `@libsql/client` (kit §14). If the offer changes, re-test the adapter instead of just swapping the URL.

## 2. Vercel projects and variables

```bash
vercel link --project afterimage-staging      # in a checkout of the repo
vercel env add APP_ENV production             # value: staging  (the staging PROJECT's "production" target)
vercel env add APP_URL production             # https://afterimage-staging.vercel.app
vercel env add BETTER_AUTH_SECRET production  # openssl rand -base64 48 (unique per environment)
vercel env add MEMORY_ID_SECRET production    # openssl rand -base64 48 (STABLE, never rotate silently)
vercel env add CRON_SECRET production         # openssl rand -base64 32
vercel env add DATABASE_URL production        # libsql://afterimage-staging-….turso.io (or TURSO_DATABASE_URL via Vercel Marketplace)
vercel env add DATABASE_AUTH_TOKEN production # (or TURSO_AUTH_TOKEN via Vercel Marketplace)
vercel env add CONVERSATION_MODE production   # live
vercel env add NAPSTER_API_KEY production
vercel env add NAPSTER_JEANNE_AGENT_ID production   # see config/napster-resources.json
vercel env add NAPSTER_MALIK_AGENT_ID production
vercel env add NAPSTER_JEANNE_AGENT_ID_EN production
vercel env add NAPSTER_MALIK_AGENT_ID_EN production
vercel env add NAPSTER_PIXO_AGENT_ID production     # optional secret 2056 booth
vercel env add NAPSTER_PIXO_AGENT_ID_EN production
vercel env add NAPSTER_MAX_ACTIVE production  # 1 on staging, 3 on production
```

Repeat for the production project with its own values (`APP_ENV=production`). Previews from external contributors must not receive production secrets.

## 3. Release procedure (staging, then production)

1. `npm run verify` green on the release commit.
2. **Back up**: take a Turso point-in-time reference or branch of the target database (for example `turso db create afterimage-prod-pre-<sha> --from-db afterimage-prod`; check the current flags).
3. **Migrate** (never at build), from the operator's machine:
   `APP_ENV=staging DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run release:migrate -- --confirm=staging`
   Migrations are additive. There are no destructive "down" migrations.
4. **Owner**: `APP_URL=https://… DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run ops:bootstrap-owner -- --email=you@…`. Open the printed link once.
5. **Deploy**: `vercel deploy --prod` from the staging project (built with staging variables).
6. **Acceptance** on HTTPS, in Chrome and Safari:
   - three runs, one per ending;
   - a network cut and a closed tab;
   - two tabs for one player, and two players at the same time;
   - `GET /api/admin/readiness` as owner;
   - the live conversation for both characters;
   - CSP violations collected (report-only), to build the allowlist before enforcing.
7. **Production**: repeat steps 2–5 on the production project. Its build uses the production variables: never promote a staging build. Then run a short acceptance with a dedicated account and delete its data ("Supprimer ma partie").

## 4. Maintenance

- Vercel Cron `/api/cron/maintenance` runs daily (Hobby-compatible), with `Authorization: Bearer $CRON_SECRET`. Opening a conversation also reconciles stale leases when capacity looks full.
- Manual run: `npm run ops:cleanup` (same code, DB lock, bounded batches).
- Retention: guest runs 7 days and account runs 30 days of inactivity; expired confirmations and rate-limit rows are purged.

## 5. Rollback and restore

- **App rollback**: `vercel promote <previous-deployment-url>` (or "Instant Rollback" in the dashboard). Migrations are additive, so the previous build can still read the DB.
- **Stop admissions** if data is at risk: set `NAPSTER_MAX_ACTIVE=0` (or `CONVERSATION_MODE=rehearsal`) and redeploy. Close open sessions with the admin "Fermer" button or `npm run ops:cleanup`.
- **DB restore**: create a database from the backup or point in time, check it, switch `DATABASE_URL`/`DATABASE_AUTH_TOKEN` on the project, redeploy, then run `ops:cleanup` to reconcile provider sessions and leases. **Rehearse it on staging before the jury day.**
- **Fallback demo**: rehearsal mode (no Napster), clearly labelled, plus a recorded video.

## 6. Monitoring

Watch: open, reserved and uncertain leases (admin page); `napster.connection.*` warnings in the Vercel logs; 409 `REVISION_CONFLICT` rates; maintenance results; spend (`npm run ops:napster-usage`). Logs never contain tokens, prompts or personal messages.
