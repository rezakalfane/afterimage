// Database helpers for scripts: migrate + idempotent seed. Shared by setup, db:migrate, db:seed, tests.
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import episode from "../../src/content/episodes/last-screening/v1/episode.json";
import characters from "../../src/content/episodes/last-screening/v1/characters.json";
import { PROMPTS } from "../../src/content/episodes/last-screening/v1/prompts";

export function openClient(url: string, authToken?: string): Client {
  if (url.startsWith("file:")) {
    const path = url.slice(5);
    if (path && !path.startsWith(":")) mkdirSync(dirname(path), { recursive: true });
  }
  return createClient({ url, authToken, timeout: 5000, intMode: "number" });
}

export async function applyMigrations(client: Client) {
  // Local file: WAL lets scripts read while the dev server writes (persistent setting).
  if ((client as { protocol?: string }).protocol === "file") await client.execute("PRAGMA journal_mode=WAL");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
}

export const PUBLIC_TENANT = { id: "ten_public_demo", name: "Démonstration publique" };

/** Idempotent: public demo tenant + immutable episode version. Safe to run any number of times. */
export async function seed(client: Client, publicSlug: string) {
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO tenants (id, slug, name, status, is_public, max_active_sessions, created_at) VALUES (?,?,?,'active',1,3,?) ON CONFLICT(id) DO NOTHING`,
    args: [PUBLIC_TENANT.id, publicSlug, PUBLIC_TENANT.name, now],
  });
  const content = JSON.stringify({ episode, characters, prompts: PROMPTS });
  const hash = createHash("sha256").update(content).digest("hex");
  const existing = await client.execute({ sql: `SELECT content_hash FROM episode_versions WHERE episode_id = ? AND version = ?`, args: [episode.id, episode.version] });
  if (!existing.rows[0]) {
    await client.execute({ sql: `INSERT INTO episode_versions (episode_id, version, content_hash, content_json, published_at) VALUES (?,?,?,?,?)`, args: [episode.id, episode.version, hash, content, now] });
    return { episode: "inserted" as const, hash };
  }
  // Published versions are immutable: a changed content must ship as a new version.
  return { episode: existing.rows[0].content_hash === hash ? ("unchanged" as const) : ("differs" as const), hash };
}
