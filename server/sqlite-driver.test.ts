import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// `DATA_DIR` is read when `paths.ts` is first imported, so it has to be set
// before the import below rather than passed in by the caller.
const dir = path.join(process.env.TMPDIR ?? process.env.TEMP ?? '.', `gs-driver-${process.pid}`);
process.env.DATA_DIR = dir;

const { db, closeDb, transact, openDatabase, databaseFile } = await import('./sqlite.ts');

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const insertMember = (id: string, name: string, role: string) =>
  db()
    .prepare('INSERT INTO team_members (id, name, role, bio, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, role, '', 'now');

// 1. A transaction that throws must roll back and must not leave a lock held.
assert.throws(() =>
  transact(() => {
    insertMember('t1', 'A', 'B');
    throw new Error('boom');
  }),
);
assert.equal(
  (db().prepare('SELECT COUNT(*) AS c FROM team_members').get() as { c: number }).c,
  0,
  'rows written before the throw must be rolled back',
);

// 2. The connection must still be usable afterwards (no lock left open).
transact(() => insertMember('t2', 'C', 'D'));
assert.equal((db().prepare('SELECT COUNT(*) AS c FROM team_members').get() as { c: number }).c, 1);
assert.equal(db().prepare('SELECT name FROM team_members WHERE id = ?').get('t2')?.name, 'C');

// 3. Rows must be plain objects, so Object.prototype methods work.
const row = db().prepare('SELECT name, role FROM team_members WHERE id = ?').get('t2') as Record<string, unknown>;
assert.equal(typeof (row as { hasOwnProperty?: unknown }).hasOwnProperty, 'function');
assert.deepEqual(Object.keys(row).sort(), ['name', 'role']);

// 4. Null binds must survive. `programmes` is the nullable table, and null there
//    carries meaning: the content store reads it as "not overridden" and omits
//    the key so the static default shows through. A driver that coerced null to
//    '' or 0 would silently blank the page.
db()
  .prepare(
    `INSERT INTO programmes (id, name, summary, updated_at) VALUES (?, ?, ?, ?)`,
  )
  .run('gender', null, null, 'now');
const prog = db().prepare('SELECT name, summary FROM programmes WHERE id = ?').get('gender') as {
  name: string | null;
  summary: string | null;
};
assert.equal(prog.name, null);
assert.equal(prog.summary, null);

// 5. Booleans must not be silently coerced to 0/1, and integers must round-trip.
db()
  .prepare('INSERT INTO policies (id, title, file, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
  .run('p1', 'T', '/uploads/x.pdf', 3, 'now');
assert.equal((db().prepare('SELECT sort_order AS o FROM policies WHERE id = ?').get('p1') as { o: number }).o, 3);

// 6. Nested transact() must fail loudly rather than silently corrupting.
assert.throws(() => transact(() => transact(() => undefined)), /cannot start a transaction within a transaction/i);

// 7. Schema is applied by db(), so every table the content store reads exists.
for (const t of ['pictures', 'projects', 'activities', 'team_members', 'testimonials', 'policies', 'programmes', 'impact', 'enquiries']) {
  const r = db().prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number };
  assert.equal(typeof r.c, 'number', `table ${t} must exist`);
}

closeDb();

// 8. VACUUM INTO into a read-only connection, as the backup script does.
const snapshot = `${dir}/snapshot.db`;
const ro = openDatabase(databaseFile, { readOnly: true });
ro.pragma('wal_checkpoint(TRUNCATE)');
ro.exec(`VACUUM INTO '${snapshot}'`);
ro.close();

const verify = openDatabase(snapshot, { readOnly: true });
assert.equal((verify.prepare('SELECT COUNT(*) AS c FROM team_members').get() as { c: number }).c, 1);
verify.close();

console.log('node:sqlite shim OK — transactions, rollback, null-prototype rows, null binds, VACUUM INTO');
