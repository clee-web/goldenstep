import { randomUUID } from 'node:crypto';

import type { EnquiryRecord } from '../shared/schemas.ts';
import { JsonFile } from './json-file.ts';
import { ENQUIRIES_FILE } from './paths.ts';

const MAX_RECORDS = Number(process.env.MAX_ENQUIRY_RECORDS ?? 10_000);

const file = new JsonFile<EnquiryRecord[]>(
  ENQUIRIES_FILE,
  () => [],
  (raw) => (Array.isArray(raw) ? (raw as EnquiryRecord[]) : []),
);

export async function saveEnquiry(
  input: Omit<EnquiryRecord, 'id' | 'receivedAt'>,
): Promise<EnquiryRecord> {
  const record: EnquiryRecord = {
    ...input,
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
  };

  await file.update((records) => {
    records.push(record);
    if (records.length > MAX_RECORDS) {
      records.splice(0, records.length - MAX_RECORDS);
    }
  });

  return record;
}

export interface EnquiryQuery {
  topic?: string;
  limit?: number;
}

export async function listEnquiries({
  topic,
  limit = 50,
}: EnquiryQuery = {}): Promise<EnquiryRecord[]> {
  const records = await file.read();
  const filtered = topic
    ? records.filter((record) => record.topic === topic)
    : records;
  return filtered.slice(-limit).reverse();
}

export async function countEnquiries(): Promise<number> {
  return (await file.read()).length;
}
