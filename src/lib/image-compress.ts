/**
 * Shrinks a payment screenshot in the browser before it is uploaded, so full-size phone
 * screenshots (often 300 KB to 2 MB) become a few tens of KB and never eat the free
 * database allowance. Readability comes first: the picture keeps its width (up to 1080 px,
 * never below 900 px unless the original is smaller) and only the compression quality is
 * lowered to reach the target size.
 */
export const PROOF_TARGET_BYTES = 60_000; // aim for this
export const PROOF_MAX_BYTES = 180_000; // never accept more than this
export const PROOF_MAX_WIDTH = 1080;
export const PROOF_MIN_WIDTH = 900; // text gets hard to read below this
export const PROOF_QUALITIES = [0.85, 0.75, 0.68, 0.6]; // never lower than the last one

export interface EncodingChoice {
  width: number;
  quality: number;
  bytes: number;
  /** false when even the most compressed readable version is above the hard maximum */
  ok: boolean;
}

/**
 * Finds the sharpest encoding that fits the target size. `encode` returns the size in bytes of
 * the picture at a given width and quality. Tries the full width first, then the minimum
 * readable width, each from best to lowest quality, and stops at the first that fits.
 * If none fits the target, the smallest readable one is used as long as it is under the hard maximum.
 */
export async function chooseEncoding(
  naturalWidth: number,
  encode: (width: number, quality: number) => Promise<number>
): Promise<EncodingChoice> {
  const full = Math.min(naturalWidth, PROOF_MAX_WIDTH);
  const smallest = Math.min(naturalWidth, PROOF_MIN_WIDTH);
  const widths = full > smallest ? [full, smallest] : [full];

  let best: EncodingChoice | null = null;
  for (const width of widths) {
    for (const quality of PROOF_QUALITIES) {
      const bytes = await encode(width, quality);
      if (bytes <= PROOF_TARGET_BYTES) return { width, quality, bytes, ok: true };
      if (!best || bytes < best.bytes) best = { width, quality, bytes, ok: bytes <= PROOF_MAX_BYTES };
    }
  }
  return best as EncodingChoice;
}

export interface CompressedProof {
  dataUrl: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  originalBytes: number;
  ok: boolean;
}

async function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image'));
      i.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, mime: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));

/** Turns a chosen picture file into a small WebP (or JPEG where WebP isn't available). */
export async function compressPaymentProof(file: File): Promise<CompressedProof> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a picture (a screenshot or photo). PDFs are not accepted.');
  }
  const { source, width: naturalWidth, height: naturalHeight } = await loadBitmap(file);

  const draw = (width: number) => {
    const height = Math.round((naturalHeight * width) / naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process the image in this browser');
    ctx.fillStyle = '#ffffff'; // transparent screenshots get a white background
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return { canvas, height };
  };

  // Prefer WebP; fall back to JPEG if this browser can't write WebP
  let mime = 'image/webp';
  const probe = await toBlob(draw(Math.min(naturalWidth, 64)).canvas, mime, 0.8);
  if (!probe || probe.type !== 'image/webp') mime = 'image/jpeg';

  const encode = async (width: number, quality: number) => (await toBlob(draw(width).canvas, mime, quality))?.size ?? Infinity;
  const choice = await chooseEncoding(naturalWidth, encode);

  const { canvas, height } = draw(choice.width);
  const blob = await toBlob(canvas, mime, choice.quality);
  if (!blob) throw new Error('Could not shrink that image');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the shrunk image'));
    reader.readAsDataURL(blob);
  });

  return { dataUrl, mime, bytes: blob.size, width: choice.width, height, originalBytes: file.size, ok: blob.size <= PROOF_MAX_BYTES };
}
