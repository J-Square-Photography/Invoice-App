import crypto from 'crypto';

/**
 * Generate a cryptographically secure, URL-safe random token for client signing links.
 * 32 bytes of randomness hex-encoded = 64 character unguessable token.
 */
export function generateSigningToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a SHA-256 cryptographic hash over the document text, signer identity,
 * signature raster data, and exact UTC timestamp.
 * This guarantees non-repudiation and tamper-evident audit protection.
 */
export function computeDocumentAuditHash(params: {
  contractBody: string;
  signerName: string;
  signerEmail?: string | null;
  signatureImageBase64: string;
  utcTimestamp: string | Date;
  clientIp: string;
}): string {
  const timestampStr = typeof params.utcTimestamp === 'string'
    ? params.utcTimestamp
    : params.utcTimestamp.toISOString();

  const canonicalPayload = [
    params.contractBody.trim(),
    params.signerName.trim().toLowerCase(),
    (params.signerEmail || '').trim().toLowerCase(),
    params.signatureImageBase64.trim(),
    timestampStr,
    params.clientIp.trim(),
  ].join('||');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}
