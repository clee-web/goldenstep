import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DatabaseSync,
  type DatabaseSyncOptions,
  type SQLInputValue,
  type StatementSync,
} from 'node:sqlite';

import { here } from './here.ts';
import { DATA_DIR } from './paths.ts';

/**
 * Database connection.
 *
 * Backed by `node:sqlite`, Node's built-in SQLite. This replaced
 * `better-sqlite3`, which is a native module: it ships as a compiled `.node`
 * binary linked against the glibc of the machine that built it. Deploying a
 * release built on a modern Linux to a host running an older one fails at
 * runtime, not at install, and the error names a symbol rather than the cause:
 *
 *   /lib64/libm.so.6: version `GLIBC_2.29' not found
 *   (required by .../better_sqlite3.node)
 *
 * Every route that reads content then returns 500 while the ones that do not
 * touch the database keep working, which reads like an application bug and is
 * not one. `node:sqlite` is compiled into the Node binary itself, so there is
 * nothing platform-specific to ship and the same release runs on any host
 * running Node 24 — including shared hosting, where no compiler is available to
 * build a native module from source.
 *
 * That trade has a floor: `node:sqlite` landed in Node 22.5, so the deployed
 * Node version is a hard requirement rather than a preference. `engines` in
 * package.json states it, and `start()` reports the running version at startup
 * so a mismatch is visible in the log before the first request.
 *
 * The synchronous API is kept deliberately. Every query here is a single
 * indexed read or write against a local file, so there is no latency to
 * overlap; the store modules still expose Promises because that is the
 * interface the routes were written against.
 *
 * The connection is opened lazily on first use rather than at import time.
 * Module-level work in this codebase runs during `tsc` and during test
 * collection, and neither should create a database file as a side effect.
 */

/** `db/schema.sql`, resolved from the app root rather than from `dist`. */
const SCHEMA_FILE = path.resolve(here, '..', 'db', 'schema.sql');

const DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(DATA_DIR, 'website.db');

/**
 * A statement.
 *
 * `node:sqlite` and `better-sqlite3` agree on `run`/`get`/`all` and disagree on
 * the shape of what comes back: the built-in returns null-prototype objects,
 * which behave like plain objects for property access and spreading but fail
 * anything that reaches for a prototype method. Rows are copied into ordinary
 * objects here so callers never have to know which driver is underneath.
 */
export interface Statement {
  run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get<T = Record<string, unknown>>(...params: SQLInputValue[]): T | undefined;
  all<T = Record<string, unknown>>(...params: SQLInputValue[]): T[];
}

/** The connection surface the rest of the server uses. */
export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  pragma(statement: string): unknown;
  close(): void;
}

const plain = (row: unknown): unknown => (row === undefined ? undefined : { ...(row as object) });

/**
 * The subset of `StatementSync` this module uses. Declared structurally rather
 * than imported so the wrappers are checked against what is actually called,
 * and so the parameter types stay `SQLInputValue` instead of widening to
 * `unknown` and losing the driver's own validation.
 */
type RawStatement = Pick<StatementSync, 'run' | 'get' | 'all'>;

/**
 * Counts the `?` placeholders in a statement.
 *
 * `?` inside a string literal is data rather than a placeholder — an uploaded
 * path can legitimately contain one — so quoted spans are skipped. A doubled
 * quote is an escaped quote, not the end of the literal, so it does not close
 * the span. Line comments are not handled: no prepared statement in this
 * codebase contains one, since the commented schema goes through `exec()`, which
 * takes no parameters.
 */
export function countPlaceholders(sql: string): number {
  let count = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (char === "'") {
      if (inString && sql[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (char === '?' && !inString) count += 1;
  }
  return count;
}

/**
 * Adapts one `node:sqlite` statement to the shape above, checking the number of
 * parameters against the statement first.
 *
 * This guard is not optional politeness. `node:sqlite` throws when given *too
 * many* parameters but silently accepts *too few*, binding NULL to the
 * remainder — so an `UPDATE ... WHERE id = ?` called without its id matches
 * nothing, reports success, and changes no rows. `better-sqlite3`, which this
 * replaced, threw in both cases, so without the check the same code went from a
 * loud 500 to silent data loss the moment the driver changed.
 *
 * A wrong count that still matches in number is not detectable here — a
 * statement can bind the right values in the wrong order — which is why the
 * update paths are covered by round-trip tests rather than trusted.
 */
function wrap(statement: RawStatement, sql: string): Statement {
  const expected = countPlaceholders(sql);
  const check = (params: SQLInputValue[]): void => {
    if (params.length !== expected) {
      throw new Error(
        `Statement expects ${expected} parameter${expected === 1 ? '' : 's'} but ` +
          `received ${params.length}: ${sql.replace(/\s+/g, ' ').trim()}`,
      );
    }
  };

  return {
    run: (...params) => {
      check(params);
      return statement.run(...params) as {
        changes: number | bigint;
        lastInsertRowid: number | bigint;
      };
    },
    get: <T,>(...params: SQLInputValue[]) => {
      check(params);
      return plain(statement.get(...params)) as T | undefined;
    },
    all: <T,>(...params: SQLInputValue[]) => {
      check(params);
      return statement.all(...params).map(plain) as T[];
    },
  };
}

let connection: Db | null = null;

export function openDatabase(file: string, options: DatabaseSyncOptions = {}): Db {
  const handle = new DatabaseSync(file, options);

  const db: Db = {
    prepare: (sql) => wrap(handle.prepare(sql), sql),
    exec: (sql) => handle.exec(sql),
    /*
     * `better-sqlite3` had a dedicated `pragma()` method. The built-in has only
     * `exec()`, and a pragma that returns a row has to be read through a
     * statement instead, so the value is fetched here rather than discarded.
     */
    pragma: (statement) => {
      const result = handle.prepare(`PRAGMA ${statement}`).get();
      return plain(result);
    },
    close: () => handle.close(),
  };

  return db;
}

export function db(): Db {
  if (connection) return connection;

  // `DATA_DIR` is the documented persistent-volume mount point, and it is
  // git-ignored, so the file lands beside `content.json` and `uploads/` and
  // survives a redeploy the same way they do.
  mkdirSync(path.dirname(DB_FILE), { recursive: true });

  const handle = openDatabase(DB_FILE);

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
 *
 * `node:sqlite` has no `transaction()` helper, so this issues the statements
 * itself. `BEGIN` is given an immediate transaction so the write lock is taken
 * up front rather than on the first write, which is what makes a read-then-write
 * such as "does this id exist" safe from interleaving.
 */
export function transact<T>(fn: () => T): T {
  const handle = db();
  handle.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    handle.exec('COMMIT');
    return result;
  } catch (error) {
    // A failed COMMIT or a throw inside `fn` leaves the transaction open, and an
    // open transaction holds the write lock for every later request.
    try {
      handle.exec('ROLLBACK');
    } catch {
      // Already rolled back by SQLite itself; the original error is the useful one.
    }
    throw error;
  }
}
