import "server-only";
// One libSQL client per process: local SQLite file (file:./var/afterimage.db) or remote libSQL (Turso).
// Mutations use `writeTx` (BEGIN IMMEDIATE / libSQL "write" transaction) with parameterized SQL.
// Never call Napster (or any network) inside `writeTx`.
import { createClient, type Client, type InStatement, type Transaction } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "@/server/env";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";
import { serializeClient, withinTransaction } from "./serialized-client";

export const schema = { ...appSchema, ...authSchema };
export type DB = LibSQLDatabase<typeof schema>;

type Handle = { client: Client; db: DB };
const g = globalThis as unknown as { __afterimageDb?: Handle };

export function openDatabase(url: string, authToken?: string): Handle {
  const raw = createClient({ url, authToken, timeout: 5000, intMode: "number", ...(url.startsWith("file:") ? { concurrency: 1 } : {}) });
  // Local file: one connection behind an async mutex (see serialized-client.ts). Remote: as is.
  const client = url.startsWith("file:") ? serializeClient(raw) : raw;
  return { client, db: drizzle(client, { schema }) };
}

function handle(): Handle {
  if (!g.__afterimageDb) {
    const e = env();
    g.__afterimageDb = openDatabase(e.DATABASE_URL, e.DATABASE_AUTH_TOKEN);
  }
  return g.__afterimageDb;
}

export const db = (): DB => handle().db;
export const sqlClient = (): Client => handle().client;

/** Tests only: point the process at another database. */
export function useDatabaseForTests(h: Handle) {
  g.__afterimageDb = h;
}

export class TxConflict extends Error {}

/**
 * Run `fn` in a short write transaction. Commits if `fn` resolves, rolls back if it throws.
 * Retries on SQLITE_BUSY (lock contention) a bounded number of times.
 */
export async function writeTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let tx: Transaction | null = null;
    try {
      tx = await sqlClient().transaction("write");
      const t = tx;
      const out = await withinTransaction(() => fn(t));
      await tx.commit();
      return out;
    } catch (e) {
      try {
        await tx?.rollback();
      } catch {
        /* already closed */
      }
      const code = (e as { code?: string }).code ?? "";
      if (attempt < 4 && /BUSY|LOCKED/.test(code)) {
        await new Promise((r) => setTimeout(r, 25 * 2 ** attempt + Math.random() * 25));
        continue;
      }
      throw e;
    } finally {
      tx?.close();
    }
  }
}

export async function exec(tx: Transaction | Client, stmt: InStatement) {
  return tx.execute(stmt);
}
