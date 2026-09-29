import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { DATA_DIR } from './paths.ts';

/**
 * Database connection.
 *
 * `better-sqlite3` is synchronous, which suits this application: every query is
 * a single indexed read or write against a local file, so there is no latency
 * to overlap and an async driver would only add a promise around work that
 * already finished. The store modules still expose Promises, because that is
 * the interface the routes were written against and changing it would touch
 * every call site for no benefit.
 *
 * The connection is opened lazily on first use rather than at import time.
 * Module-level work in this codebase runs during `tsc` and during test
 * collection, and neither should create a database file as a side effect.
 */

/** `db/schema.sql`, resolved from the repo root rather than from `dist`. */
const SCHEMA_FILE = path.resolve(import.meta.dirname, '..', 'db', 'schema.sql');

const DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(DATA_DIR, 'website.db');

export type Db = Database.Database;

let connection: Db | null = null;

export function db(): Db {
  if (connection) return connection;

  // `DATA_DIR` is the documented persistent-volume mount point, and it is
  // git-ignored, so the file lands beside `content.json` and `uploads/` and
  // survives a redeploy the same way they do.
  mkdirSync(path.dirname(DB_FILE), { recursive: true });

  const handle = new Database(DB_FILE);

  // WAL lets readers run while a write is in flight. The JSON store serialised
  // every write through a promise queue; SQLite does that itself, so the
  // contention this app actually has (one operator, one form) is not a
  // bottleneck either way — WAL is here so a slow public `/api/content` read
  // cannot block a dashboard save.
  handle.pragma('journal_mode = WAL');
  // Without this SQLite ignores the durability level and a power loss can lose a
  // committed enquiry. NORMAL is the right trade for this workload: it is
  // crash-safe, and only risks the last few milliseconds on an OS crash.
  handle.pragma('synchronous = NORMAL');
  handle.pragma('foreign_keys = ON');

  handle.exec(readFileSync(SCHEMA_FILE, 'utf8'));

  connection = handle;
  return connection;
}

/** Closes the connection. Used by tests and by the migration script. */
export function closeDb(): void {
  connection?.close();
  connection = null;
}

export const databaseFile = DB_FILE;

/**
 * Runs `fn` inside a transaction and returns its result.
 *
 * Used wherever a single logical operation touches more than one row, so a
 * failure part-way through cannot leave the store in a state the dashboard
 * would render as valid. A no-op when `fn` only reads, which is the common case.
 */
export function transact<T>(fn: () => T): T {
  return db().transaction(fn)();
}
