import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { DATA_DIR, UPLOADS_DIR } from './paths.ts';
import { closeDb, databaseFile, openDatabase } from './sqlite.ts';
import { contentCounts, describeContent, inspectStorage } from './persistence.ts';

/**
 * Backup and restore for the dashboard's data.
 *
 * Both halves are needed and they behave differently:
 *
 *   website.db   The database, snapshotted with `VACUUM INTO` rather than
 *                copied. This matters: the database runs in WAL mode, so recent
 *                commits live in `website.db-wal` until a checkpoint. Copying
 *                the `.db` on its own produces a file that is internally valid
 *                but silently missing the last writes — a backup that restores
 *                to slightly stale data, which is the worst kind, because
 *                nothing reports an error. `VACUUM INTO` reads through a
 *                consistent snapshot and writes a single checkpointed file.
 *
 *   uploads/     Plain files, so a directory copy is correct. Policy PDFs live
 *                here and are not in the database — restoring the database
 *                without them leaves every policy row pointing at a missing
 *                file, which renders as a broken download link.
 *
 * Usage:
 *   npm run backup                    writes ./backups/<timestamp>/
 *   npm run backup -- --out /mnt/disk writes there instead
 *   npm run backup -- --no-uploads    database only, much faster
 *   npm run restore -- ./backups/...  copies a bundle back over DATA_DIR
 */

const BACKUP_ROOT = path.resolve(process.env.BACKUP_DIR ?? 'backups');

/** Filesystem-safe timestamp, so the name sorts chronologically. */
const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function parseArgs(argv: string[]): { out?: string; includeUploads: boolean; restore?: string } {
  const options: { out?: string; includeUploads: boolean; restore?: string } = {
    includeUploads: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') options.out = argv[++i];
    else if (arg === '--no-uploads') options.includeUploads = false;
    else if (arg === '--restore') options.restore = argv[++i];
  }
  return options;
}

function requireDatabase(): void {
  if (!existsSync(databaseFile)) {
    console.error(
      `No database at ${databaseFile}.\n` +
        'Nothing to back up. If you expected one here, DATA_DIR is pointing somewhere else.',
    );
    process.exit(1);
  }
}

function backup(out?: string, includeUploads = true): void {
  requireDatabase();

  const target = path.resolve(out ?? path.join(BACKUP_ROOT, stamp()));
  if (existsSync(target)) {
    console.error(
      `${target} already exists. Pick another --out, or remove it.\n` +
        'Refusing to overwrite, because that would replace the only remaining copy.',
    );
    process.exit(1);
  }
  mkdirSync(target, { recursive: true });

  const counts = contentCounts();
  console.log(`Backing up ${describeContent(counts)}`);
  console.log(`  from ${DATA_DIR}`);
  console.log(`  to   ${target}`);

  const storage = inspectStorage();
  if (storage.durability === 'ephemeral') {
    console.warn(
      '\n  NOTE: DATA_DIR is not on a persistent mount. This backup is currently the\n' +
        '  only copy of your content — losing this machine loses everything.',
    );
  }

  /*
   * `VACUUM INTO` cannot run inside a transaction, so it is issued directly on
   * the connection. better-sqlite3 is synchronous, which is why this needs no
   * await: the snapshot is complete when the call returns.
   */
  const dbFile = path.join(target, 'website.db');
  const handle = openDatabase(databaseFile, { readOnly: true });
  try {
    handle.pragma('wal_checkpoint(TRUNCATE)');
    handle.exec(`VACUUM INTO ${quoteSqlString(dbFile)}`);
  } finally {
    handle.close();
  }
  console.log('  website.db   written (WAL-safe snapshot)');

  if (includeUploads) {
    if (existsSync(UPLOADS_DIR)) {
      cpSync(UPLOADS_DIR, path.join(target, 'uploads'), { recursive: true });
      console.log('  uploads/     copied');
    } else {
      console.log('  uploads/     nothing to copy');
    }
  } else {
    console.log('  uploads/     skipped (--no-uploads)');
  }

  closeDb();

  const manifest = {
    createdAt: new Date().toISOString(),
    dataDir: DATA_DIR,
    contents: counts,
    includesUploads: includeUploads,
    restoreWith: `npm run restore -- ${target}`,
  };
  writeFileSync(path.join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nDone. Restore with:\n  npm run restore -- ${target}\n`);
}

/** SQLite string literals use single quotes; double any inside. */
function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function restore(source: string): void {
  const from = path.resolve(source);
  const dbFile = path.join(from, 'website.db');

  if (!existsSync(dbFile)) {
    console.error(
      `No website.db inside ${from}.\n` +
        'Point --restore at the backup directory itself, not at the database file.',
    );
    process.exit(1);
  }

  closeDb();

  /*
   * Any `-wal` and `-shm` files next to the live database describe writes that
   * are already reflected in the file being replaced. Left in place, SQLite
   * would replay them over the restored data on the next open and undo it.
   */
  for (const suffix of ['-wal', '-shm']) {
    rmSync(`${databaseFile}${suffix}`, { force: true });
  }
  mkdirSync(path.dirname(databaseFile), { recursive: true });
  cpSync(dbFile, databaseFile);

  const fromUploads = path.join(from, 'uploads');
  if (existsSync(fromUploads)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    cpSync(fromUploads, UPLOADS_DIR, { recursive: true });
    console.log(`Restored ${UPLOADS_DIR}`);
  } else {
    console.warn(
      'This backup has no uploads/ directory. Any policy document uploaded after the\n' +
        'snapshot is still missing, and those download links will be broken.',
    );
  }

  const counts = contentCounts();
  console.log(`Restored ${describeContent(counts)} to ${DATA_DIR}`);
  console.log('Restart the application to pick this up.');
}

const options = parseArgs(process.argv.slice(2));
if (options.restore) restore(options.restore);
else backup(options.out, options.includeUploads);
