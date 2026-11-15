import "server-only";
// LOCAL SQLite only (file: URLs). The local libSQL driver runs statements synchronously across a
// pool of connections: when two connections contend, SQLite's busy handler blocks the whole thread
// (the lock holder cannot progress) and Better Auth's own writes fail with SQLITE_BUSY.
// We therefore route every access through ONE connection guarded by an async mutex: transactions
// hold the mutex until commit/rollback, other callers queue in JS instead of in SQLite.
// Remote libSQL (Turso) is NOT wrapped: the server serializes writes there.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Client, InArgs, InStatement, ResultSet, Transaction, TransactionMode } from "@libsql/client";

class Mutex {
  private tail: Promise<void> = Promise.resolve();
  lock(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = this.tail;
    this.tail = prev.then(() => next);
    return prev.then(() => release);
  }
}

const inTx = new AsyncLocalStorage<boolean>();

/** Run a transaction body: any `client.*` call from inside it throws instead of deadlocking. */
export function withinTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return inTx.run(true, fn);
}

export function serializeClient(inner: Client): Client {
  const mutex = new Mutex();
  const guard = () => {
    if (inTx.getStore()) throw new Error("DB access through the client inside an open transaction: use the `tx` object (would deadlock).");
  };
  const locked = async <T>(fn: () => Promise<T>): Promise<T> => {
    guard();
    const release = await mutex.lock();
    try {
      return await fn();
    } finally {
      release();
    }
  };

  const wrapped: Partial<Client> = {
    execute: ((stmt: InStatement | string, args?: InArgs) => locked(() => (args === undefined ? inner.execute(stmt as InStatement) : inner.execute(stmt as string, args)))) as Client["execute"],
    batch: ((stmts: InStatement[], mode?: TransactionMode) => locked(() => inner.batch(stmts, mode))) as Client["batch"],
    migrate: ((stmts: InStatement[]) => locked(() => inner.migrate(stmts))) as Client["migrate"],
    executeMultiple: (sql: string) => locked(() => inner.executeMultiple(sql)),
    transaction: (async (mode?: TransactionMode) => {
      guard();
      const release = await mutex.lock();
      let tx: Transaction;
      try {
        tx = await inner.transaction(mode);
      } catch (e) {
        release();
        throw e;
      }
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          release();
        }
      };
      // Statements on the tx run "inside" (the guard forbids client calls from that async context).
      const run = <T>(fn: () => Promise<T>) => inTx.run(true, fn);
      return {
        execute: ((s: InStatement | string, a?: InArgs) => run(() => tx.execute(a === undefined ? (s as InStatement) : { sql: s as string, args: a }))) as Transaction["execute"],
        batch: (stmts: InStatement[]) => run(() => tx.batch(stmts)),
        executeMultiple: (sql: string) => run(() => tx.executeMultiple(sql)),
        commit: async () => {
          try {
            await tx.commit();
          } finally {
            finish();
          }
        },
        rollback: async () => {
          try {
            await tx.rollback();
          } finally {
            finish();
          }
        },
        close: () => {
          try {
            tx.close();
          } finally {
            finish();
          }
        },
        get closed() {
          return tx.closed;
        },
      } as Transaction;
    }) as Client["transaction"],
    sync: () => inner.sync(),
    close: () => inner.close(),
  };
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop in wrapped) return (wrapped as Record<string | symbol, unknown>)[prop];
      return Reflect.get(target, prop, receiver);
    },
  });
}

export type { ResultSet };
