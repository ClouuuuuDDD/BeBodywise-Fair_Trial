import type { LabelKind } from './types';

/**
 * Pulls the ingredient list out of raw OCR text: everything after an "Ingredients" heading if
 * there is one (else the whole text), line breaks joined, stray directions cut at the first
 * sentence that starts a usage or warning line.
 */
export function extractIngredientsFromOcr(raw: string): string {
  const flat = raw.replace(/\r/g, '').replace(/-\n(?=[a-z])/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const m = /\b(?:ingredients?|inci)\s*[:-]?\s*/i.exec(flat);
  let text = m ? flat.slice(m.index + m[0].length) : flat;
  const stop = /\b(?:how to use|directions?|warnings?|caution|storage|store in|manufactured|marketed|mfd|best before|batch)\b/i.exec(text);
  if (stop && stop.index > 20) text = text.slice(0, stop.index);
  return text.replace(/[|]/g, ' ').replace(/\s+/g, ' ').replace(/[\s,;.]+$/, '').trim();
}

/** Best guess at a product name from the front: the first two non-empty lines. Low confidence; she edits it. */
export function guessNameFromOcr(raw: string): string {
  const lines = raw
    .split(/\n/)
    .map((l) => l.replace(/[^\w &'%.\-+]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 3);
  return lines.slice(0, 2).join(' ');
}

/** Runs Tesseract.js (English) in the browser. Lazy: the library and its data load only on first use. */
export async function recognizeText(photo: Blob): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(photo);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export type OcrFn = (photo: Blob, kind: LabelKind) => Promise<string>;
