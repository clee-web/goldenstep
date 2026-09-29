import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { DATA_DIR } from './paths.ts';
import { db } from './sqlite.ts';

/**
 * Detects whether `DATA_DIR` sits on storage that outlives the process.
 *
 * The failure this exists to prevent is silent. A container started without a
 * volume mounts `/data` as an ordinary directory on the image's own writable
 * layer, so the application starts normally, creates a fresh empty database,
 * and serves a working site with no content in it. Nothing errors. The operator
 * adds photographs and policies, the deploy pipeline rebuilds, and all of it is
 * gone — with no message at any point to say why.
 *
 * The check is a mount-point lookup rather than a guess, because the difference
 * between "correctly configured" and "about to lose everything" is precisely
 * whether `/data` is its own filesystem.
 */

export type Durability = 'durable' | 'ephemeral' | 'unknown';

export interface StorageReport {
  durability: Durability;
  /** Absolute, symlink-resolved data directory. */
  dataDir: string;
  /** Why the answer is what it is. Shown in logs and on /api/health. */
  detail: string;
  /** The mount backing DATA_DIR, or null when it is on the root filesystem. */
  mountPoint: string | null;
}

/** `/proc/self/mountinfo` escapes these four characters in the mount path. */
function unescapeMountPath(value: string): string {
  return value
    .replace(/\\040/g, ' ')
    .replace(/\\011/g, '\t')
    .replace(/\\012/g, '\n')
    .replace(/\\134/g, '\\');
}

/**
 * Every real mount point on this system, excluding `/`.
 *
 * `/` is excluded deliberately: it is always a mount, and treating it as one
 * would make every directory look durable and the check would never fire.
 */
function mountPoints(): string[] {
  let raw: string;
  try {
    raw = readFileSync('/proc/self/mountinfo', 'utf8');
  } catch {
    return [];
  }

  const points: string[] = [];
  for (const line of raw.split('\n')) {
    // Fields are space separated: id, parent, major:minor, root, mount point.
    const mountPoint = line.split(' ')[4];
    if (!mountPoint) continue;
    const resolved = unescapeMountPath(mountPoint);
    if (resolved === '/') continue;
    points.push(resolved);
  }
  return points;
}

function realpathOrSelf(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/**
 * The most specific mount containing `target`, or null if only the root
 * filesystem does.
 */
function backingMount(target: string): string | null {
  let best: string | null = null;
  for (const point of mountPoints()) {
    const resolved = realpathOrSelf(point);
    const isMatch = target === resolved || target.startsWith(resolved + path.sep);
    if (isMatch && (best === null || resolved.length > best.length)) best = resolved;
  }
  return best;
}

/**
 * Classifies `DATA_DIR`.
 *
 * Only Linux exposes mount information in a portable way, and the container
 * case is the one that matters, so anything else reports `unknown` and the
 * caller stays quiet rather than crying wolf on a developer laptop.
 */
export function inspectStorage(): StorageReport {
  const dataDir = realpathOrSelf(DATA_DIR);

  if (process.platform !== 'linux') {
    return {
      durability: 'unknown',
      dataDir,
      detail: `Not Linux, so mount information is unavailable (${process.platform}).`,
      mountPoint: null,
    };
  }

  const mount = backingMount(dataDir);
  if (mount) {
    return {
      durability: 'durable',
      dataDir,
      detail: `${dataDir} is on its own mount at ${mount}, so it survives a redeploy.`,
      mountPoint: mount,
    };
  }

  return {
    durability: 'ephemeral',
    dataDir,
    detail:
      `${dataDir} is not a mount point — it is an ordinary directory on the ` +
      `container's own filesystem, which is destroyed on every redeploy.`,
    mountPoint: null,
  };
}

/**
 * Row counts per table, so a warning can state what is actually at stake.
 *
 * Empty by default: a missing table is not worth failing startup over, and the
 * counts are only ever used to make a log line more concrete.
 */
export function contentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  try {
    for (const table of [
      'pictures',
      'projects',
      'activities',
      'team_members',
      'testimonials',
      'policies',
      'enquiries',
    ]) {
      try {
        counts[table] = (db().prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number })
          .n;
      } catch {
        counts[table] = 0;
      }
    }
  } catch {
    /* No database yet. Nothing to count. */
  }
  return counts;
}

/** Renders "3 projects, 9 policies, 2 enquiries" for a log line. */
export function describeContent(counts: Record<string, number>): string {
  const labels: Record<string, string> = {
    pictures: 'pictures',
    projects: 'projects',
    activities: 'updates',
    team_members: 'team members',
    testimonials: 'testimonials',
    policies: 'policies',
    enquiries: 'enquiries',
  };
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `${n} ${labels[table] ?? table}`);
  return parts.length > 0 ? parts.join(', ') : 'an empty database';
}
