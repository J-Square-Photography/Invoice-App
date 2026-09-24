import { prisma } from '@/lib/prisma';

/** Hard ceiling for a stored proof image. The browser aims far lower (about 60 KB). */
export const PROOF_STORED_MAX_BYTES = 250_000;

/** Supabase's free plan allows 500 MB of database. */
export const FREE_DB_LIMIT_BYTES = 500 * 1024 * 1024;
export const STORAGE_WARN_RATIO = 0.7;
/** Past this, new proof images are refused (payments can still be recorded with a reference). */
export const STORAGE_BLOCK_RATIO = 0.9;

const PROOF_DATA_URL = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+=*)$/;

/** Validates an uploaded proof image and turns it into bytes. Returns an error message instead of throwing. */
export function parseProofDataUrl(value: unknown): { mime: string; data: Buffer } | { error: string } {
  if (typeof value !== 'string' || value.length === 0) return { error: 'No image received.' };
  // Check the encoded length first so an oversized upload is rejected before decoding it
  if (value.length > Math.ceil((PROOF_STORED_MAX_BYTES * 4) / 3) + 64) {
    return { error: 'That image is too large after shrinking. Try a smaller screenshot.' };
  }
  const match = PROOF_DATA_URL.exec(value);
  if (!match) return { error: 'The proof must be a WebP, JPEG or PNG picture.' };
  const data = Buffer.from(match[2], 'base64');
  if (data.length === 0 || data.length > PROOF_STORED_MAX_BYTES) {
    return { error: 'That image is too large after shrinking. Try a smaller screenshot.' };
  }
  return { mime: match[1], data };
}

export interface StorageStatus {
  databaseBytes: number;
  limitBytes: number;
  usedRatio: number;
  proofBytes: number;
  proofCount: number;
  level: 'ok' | 'warn' | 'full';
}

export function storageLevel(usedRatio: number): StorageStatus['level'] {
  if (usedRatio >= STORAGE_BLOCK_RATIO) return 'full';
  if (usedRatio >= STORAGE_WARN_RATIO) return 'warn';
  return 'ok';
}

/** How much of the free database allowance is used, and how much of it is proof images (payment
 * proofs and payslip proofs together). */
export async function getStorageStatus(): Promise<StorageStatus> {
  const [db, proofs] = await Promise.all([
    prisma.$queryRaw<Array<{ size: bigint }>>`SELECT pg_database_size(current_database()) AS size`,
    prisma.$queryRaw<Array<{ bytes: bigint | null; count: bigint }>>`
      SELECT COALESCE(SUM(octet_length(data)), 0) AS bytes, COUNT(*) AS count FROM (
        SELECT data FROM payment_proofs
        UNION ALL
        SELECT data FROM payslip_proofs
      ) proofs
    `,
  ]);
  const databaseBytes = Number(db[0]?.size ?? 0);
  const usedRatio = databaseBytes / FREE_DB_LIMIT_BYTES;
  return {
    databaseBytes,
    limitBytes: FREE_DB_LIMIT_BYTES,
    usedRatio,
    proofBytes: Number(proofs[0]?.bytes ?? 0),
    proofCount: Number(proofs[0]?.count ?? 0),
    level: storageLevel(usedRatio),
  };
}

/** A payment needs evidence that the money arrived: a proof image, a bank reference, or (for cash/cheque) a note. */
export function hasPaymentEvidence(input: { hasProof: boolean; reference?: unknown; notes?: unknown; method?: unknown }): boolean {
  if (input.hasProof) return true;
  if (typeof input.reference === 'string' && input.reference.trim()) return true;
  const manual = input.method === 'CASH' || input.method === 'CHEQUE';
  return manual && typeof input.notes === 'string' && input.notes.trim().length > 0;
}
