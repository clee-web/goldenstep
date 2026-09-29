import { randomUUID } from 'node:crypto';

import type { EnquiryRecord } from '../shared/schemas.ts';
import { db, transact } from './sqlite.ts';

/**
 * Enquiries, in SQLite.
 *
 * Same exported surface as the JSON version, so `routes.ts` is unchanged.
 *
 * The one behavioural difference worth stating: the JSON store trimmed the
 * in-memory array to `MAX_RECORDS` on every write, which silently discarded the
 * oldest enquiries. Doing that here would mean a `DELETE` on every insert, so
 * the ceiling is instead applied opportunistically — see `enforceCap`. The
 * visible result for the operator is identical (the cap holds), but a normal
 * insert no longer costs a write to the whole table.
 */

const MAX_RECORDS = Number(process.env.MAX_ENQUIRY_RECORDS ?? 10_000);

export async function saveEnquiry(
  input: Omit<EnquiryRecord, 'id' | 'receivedAt'>,
): Promise<EnquiryRecord> {
  return transact(() => {
    const record: EnquiryRecord = {
      ...input,
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
    };

    db()
      .prepare(
        `INSERT INTO enquiries (id, name, email, organisation, topic, message, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.name,
        record.email,
        record.organisation ?? '',
        record.topic,
        record.message,
        record.receivedAt,
      );

    enforceCap();
    return record;
  });
}

/**
 * Drops the oldest enquiries once the table exceeds the cap.
 *
 * Only runs when the count is actually over the limit, and does the delete in
 * one statement rather than reading the whole table into memory to `splice` it.
 * Counting on every insert is cheap — it is a `COUNT(*)` on a table capped at
 * ten thousand rows — and a delete on every insert is not.
 */
function enforceCap(): void {
  const { count } = db().prepare('SELECT COUNT(*) AS count FROM enquiries').get() as {
    count: number;
  };
  if (count <= MAX_RECORDS) return;

  db()
    .prepare(
      `DELETE FROM enquiries WHERE id IN (
         SELECT id FROM enquiries ORDER BY received_at DESC, rowid DESC LIMIT -1 OFFSET ?
       )`,
    )
    .run(MAX_RECORDS);
}

export interface EnquiryQuery {
  topic?: string;
  limit?: number;
}

export async function listEnquiries({
  topic,
  limit = 50,
}: EnquiryQuery = {}): Promise<EnquiryRecord[]> {
  // Newest first, matching the old `slice(-limit).reverse()`. `rowid DESC` is
  // the tiebreak so two enquiries that share a millisecond keep a stable order
  // instead of shuffling between requests.
  const base = `SELECT id, name, email, organisation, topic, message, received_at AS receivedAt
                  FROM enquiries`;
  const handle = db();

  if (topic) {
    return handle
      .prepare(`${base} WHERE topic = ? ORDER BY received_at DESC, rowid DESC LIMIT ?`)
      .all(topic, limit) as EnquiryRecord[];
  }
  return handle
    .prepare(`${base} ORDER BY received_at DESC, rowid DESC LIMIT ?`)
    .all(limit) as EnquiryRecord[];
}

export async function countEnquiries(): Promise<number> {
  const { count } = db().prepare('SELECT COUNT(*) AS count FROM enquiries').get() as {
    count: number;
  };
  return count;
}
