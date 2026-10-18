import type { LabelParse } from '../engine/classifyIngredients';

/** Which side of the pack the photo shows. */
export type LabelKind = 'front' | 'ingredients';

/** Wire response of POST /api/read-label (mirrors functions/_lib/readLabelCore.ts). */
export interface ReadLabelApiResponse {
  ok: boolean;
  kind: LabelKind;
  name?: string;
  brand?: string;
  ingredientsText?: string;
  provider: 'gemini' | 'openrouter' | 'none';
  error?: string;
  message?: string;
}

/** Where the text came from. */
export type LabelSource = 'gemini' | 'openrouter' | 'tesseract' | 'cached' | 'typed';

/**
 * Outcome of one read.
 * - ok: text read and (for ingredients) it passes the retake rule.
 * - retake: text read but under 4 ingredients or no commas: "Hold it flat, closer, in daylight."
 * - manual: nothing could read it: show "type it in".
 */
export type LabelReadStatus = 'ok' | 'retake' | 'manual';

/** The `status` property of the `label_read_completed` event (events.md). */
export type LabelEventStatus = 'ok' | 'retake' | 'error' | 'ocr-fallback';

export interface LabelReadResult {
  kind: LabelKind;
  status: LabelReadStatus;
  source: LabelSource | null;
  /** Product name read from the front. */
  name: string | null;
  brand: string | null;
  /** INCI text as read (not yet confirmed by her). */
  ingredientsText: string | null;
  /** Engine parse of ingredientsText (classified list + retake verdict). Null for the front side. */
  parse: LabelParse | null;
  /** Milliseconds from start to result. */
  latencyMs: number;
  /** HTTP status of the last /api/read-label call, or null if none was made. */
  httpStatus: number | null;
  /** True when the in-browser OCR produced the text. */
  usedOcr: boolean;
}
