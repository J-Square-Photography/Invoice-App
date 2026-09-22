import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
// fontkit's Indic-script shaping (Tamil, Devanagari, ...) expects this global
import 'regenerator-runtime/runtime';

/**
 * The standard PDF fonts (Helvetica) only draw Western characters. For names in other
 * languages (Chinese, Japanese, Korean, Tamil, Thai, Vietnamese, ...) we fetch a
 * Google Noto font subset that contains ONLY the characters actually used, embed it
 * (subset again by pdf-lib), and draw those characters with it. A document made of
 * plain English text never touches any of this, so its size is unchanged, and a
 * document with a short Chinese title grows by only a few KB. If the fonts can't be
 * fetched, those characters fall back to "?" as before.
 */

/** Characters Helvetica can draw. */
const BASIC = /^[\x20-\x7E\u00A0-\u00FF\u2022\u2013\u2014\u2018\u2019\u201C\u201D]$/;
export const isBasicChar = (ch: string) => BASIC.test(ch);
export const hasNonBasic = (s: string) => Array.from(s).some((c) => !isBasicChar(c) && !/\s/.test(c));

/** Which Noto family draws a given code point (left-to-right scripts only). */
function familyFor(cp: number): string | null {
  if ((cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff)) return 'Noto Sans JP';
  if ((cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f)) return 'Noto Sans KR';
  if (
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xffef) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x20000 && cp <= 0x2fa1f)
  )
    return 'Noto Sans SC';
  if (cp >= 0x0b80 && cp <= 0x0bff) return 'Noto Sans Tamil';
  if (cp >= 0x0e00 && cp <= 0x0e7f) return 'Noto Sans Thai';
  if (cp >= 0x0900 && cp <= 0x097f) return 'Noto Sans Devanagari';
  if (cp >= 0x0980 && cp <= 0x09ff) return 'Noto Sans Bengali';
  if (cp >= 0x0d00 && cp <= 0x0d7f) return 'Noto Sans Malayalam';
  if (cp >= 0x0c00 && cp <= 0x0c7f) return 'Noto Sans Telugu';
  // Vietnamese, Greek, Cyrillic, extended Latin, general symbols
  return 'Noto Sans';
}

export interface FallbackFont {
  font: PDFFont;
  chars: Set<number>;
}

export async function loadUnicodeFonts(pdfDoc: PDFDocument, texts: Array<string | null | undefined>): Promise<FallbackFont[]> {
  const unusual = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const ch of Array.from(t)) if (!isBasicChar(ch) && !/\s/.test(ch)) unusual.add(ch);
  }
  if (unusual.size === 0) return [];

  const families = new Set<string>();
  for (const ch of unusual) {
    const fam = familyFor(ch.codePointAt(0)!);
    if (fam) families.add(fam);
  }
  // The Chinese/Japanese/Korean fonts also cover Latin and common symbols, so list them first
  const ordered = [...families].sort((a, b) => Number(b.length > 12) - Number(a.length > 12));

  try {
    const query =
      ordered.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&') +
      `&text=${encodeURIComponent([...unusual].join(''))}`;
    const signal = AbortSignal.timeout(6000);
    // An old-browser User-Agent makes Google serve WOFF (which fontkit reads) instead of WOFF2
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?${query}`, {
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.34 Safari/534.24' },
      })
    ).text();
    const urls = [...css.matchAll(/src:\s*url\(([^)]+)\)/g)].map((m) => m[1]);
    if (urls.length === 0) return [];

    pdfDoc.registerFontkit(fontkit);
    const out: FallbackFont[] = [];
    for (const url of urls) {
      const bytes = new Uint8Array(await (await fetch(url, { signal })).arrayBuffer());
      const font = await pdfDoc.embedFont(bytes, { subset: true });
      out.push({ font, chars: new Set(font.getCharacterSet()) });
    }
    return out;
  } catch (error) {
    console.error('Could not load fonts for non-Latin text, using "?" instead:', error);
    return [];
  }
}

export interface Run {
  text: string;
  /** null = draw with the normal (Helvetica) font passed by the caller */
  font: PDFFont | null;
}

/** Splits a string into runs, each drawn with the Helvetica font or a fallback font. */
export function splitRuns(s: string, fallbacks: FallbackFont[]): Run[] {
  const runs: Run[] = [];
  const push = (ch: string, font: PDFFont | null) => {
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.text += ch;
    else runs.push({ text: ch, font });
  };
  for (const ch of Array.from(s.replace(/[\r\n\t]+/g, ' '))) {
    if (isBasicChar(ch)) {
      push(ch, null);
      continue;
    }
    const cp = ch.codePointAt(0)!;
    const fb = fallbacks.find((f) => f.chars.has(cp));
    if (fb) push(ch, fb.font);
    else push('?', null);
  }
  return runs;
}

/** Width of a string drawn with `font`, using fallback fonts for the characters it can't draw. */
export function measureText(s: string, size: number, font: PDFFont, fallbacks: FallbackFont[]): number {
  return splitRuns(s, fallbacks).reduce((w, r) => w + (r.font ?? font).widthOfTextAtSize(r.text, size), 0);
}

/**
 * Makes page.drawText language-aware: characters Helvetica can't draw are drawn with the
 * fallback fonts (or "?" if none), instead of throwing. For code that calls drawText directly.
 */
export function patchPage(page: PDFPage, fallbacks: FallbackFont[]): PDFPage {
  const original = page.drawText.bind(page);
  page.drawText = ((text: string, options: Parameters<PDFPage['drawText']>[1] = {}) => {
    const { font, size, x } = options;
    if (!font || size == null || x == null) {
      return original(splitRuns(text, []).map((r) => r.text).join(''), options);
    }
    let cx = x;
    for (const r of splitRuns(text, fallbacks)) {
      const f = r.font ?? font;
      original(r.text, { ...options, x: cx, font: f });
      cx += f.widthOfTextAtSize(r.text, size);
    }
  }) as PDFPage['drawText'];
  return page;
}