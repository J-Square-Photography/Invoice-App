import { describe, it, expect } from 'vitest';
import { parseProofDataUrl, hasPaymentEvidence, storageLevel, PROOF_STORED_MAX_BYTES } from '../payment-proof';
import { chooseEncoding, PROOF_TARGET_BYTES, PROOF_MAX_BYTES } from '../image-compress';

const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';

describe('proof upload validation', () => {
  it('accepts small WebP/JPEG/PNG pictures', () => {
    const r = parseProofDataUrl(tinyPng);
    expect('data' in r && r.mime).toBe('image/png');
  });

  it('rejects other types, empty values and oversize pictures', () => {
    expect('error' in parseProofDataUrl('data:application/pdf;base64,AAAA')).toBe(true);
    expect('error' in parseProofDataUrl('data:image/svg+xml;base64,AAAA')).toBe(true);
    expect('error' in parseProofDataUrl('')).toBe(true);
    expect('error' in parseProofDataUrl(null)).toBe(true);
    const big = `data:image/webp;base64,${'A'.repeat(Math.ceil((PROOF_STORED_MAX_BYTES * 4) / 3) + 200)}`;
    expect('error' in parseProofDataUrl(big)).toBe(true);
  });
});

describe('payment evidence', () => {
  it('needs a proof image or a reference', () => {
    expect(hasPaymentEvidence({ hasProof: false })).toBe(false);
    expect(hasPaymentEvidence({ hasProof: false, reference: '   ' })).toBe(false);
    expect(hasPaymentEvidence({ hasProof: true })).toBe(true);
    expect(hasPaymentEvidence({ hasProof: false, reference: 'DBS-984210' })).toBe(true);
  });

  it('cash and cheque can be backed by a note (e.g. a receipt number) instead', () => {
    expect(hasPaymentEvidence({ hasProof: false, method: 'CASH', notes: 'Receipt 0042' })).toBe(true);
    expect(hasPaymentEvidence({ hasProof: false, method: 'PAYNOW_QR', notes: 'they said they paid' })).toBe(false);
  });
});

describe('storage level', () => {
  it('warns at 70% and stops new proofs at 90% of the free allowance', () => {
    expect(storageLevel(0.1)).toBe('ok');
    expect(storageLevel(0.7)).toBe('warn');
    expect(storageLevel(0.89)).toBe('warn');
    expect(storageLevel(0.9)).toBe('full');
  });
});

describe('screenshot shrinking', () => {
  it('keeps full width and high quality when the picture already fits', async () => {
    const tried: Array<[number, number]> = [];
    const choice = await chooseEncoding(1179, async (w, q) => {
      tried.push([w, q]);
      return 40_000;
    });
    expect(choice).toMatchObject({ width: 1080, quality: 0.85, ok: true });
    expect(tried).toHaveLength(1);
  });

  it('lowers quality before it ever lowers the width', async () => {
    // Fits only at quality 0.68
    const choice = await chooseEncoding(1179, async (_w, q) => (q > 0.7 ? 120_000 : 50_000));
    expect(choice).toMatchObject({ width: 1080, quality: 0.68, ok: true });
  });

  it('only then drops to the minimum readable width, never below it', async () => {
    const widths = new Set<number>();
    const choice = await chooseEncoding(1179, async (w, q) => {
      widths.add(w);
      return w === 1080 ? 200_000 : q >= 0.85 ? 90_000 : 55_000;
    });
    expect(choice.width).toBe(900);
    expect(Math.min(...widths)).toBe(900);
    expect(choice.bytes).toBeLessThanOrEqual(PROOF_TARGET_BYTES);
  });

  it('never upscales a small picture', async () => {
    const choice = await chooseEncoding(600, async () => 30_000);
    expect(choice.width).toBe(600);
  });

  it('reports a picture that cannot get under the hard maximum', async () => {
    const choice = await chooseEncoding(1179, async () => PROOF_MAX_BYTES + 50_000);
    expect(choice.ok).toBe(false);
  });

  it('settles for the smallest readable version between the target and the maximum', async () => {
    const choice = await chooseEncoding(1179, async (w, q) => (w === 900 && q === 0.6 ? 100_000 : 150_000));
    expect(choice).toMatchObject({ width: 900, quality: 0.6, bytes: 100_000, ok: true });
  });
});
