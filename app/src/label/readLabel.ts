import { readLabel as parseIngredientText } from '../engine/classifyIngredients';
import { callReadLabelApi, LabelApiError } from './api';
import { extractIngredientsFromOcr, guessNameFromOcr, recognizeText, type OcrFn } from './ocr';
import { resizeLabelPhoto, type ResizedPhoto } from './resize';
import type { LabelEventStatus, LabelKind, LabelReadResult, LabelSource, ReadLabelApiResponse } from './types';

/** Swappable pieces, so tests can mock the network, the canvas and the OCR. */
export interface ReadDeps {
  resize: (photo: Blob) => Promise<ResizedPhoto>;
  callApi: (base64: string, kind: LabelKind) => Promise<ReadLabelApiResponse>;
  ocr: OcrFn;
  now: () => number;
}

const defaultDeps: ReadDeps = {
  resize: resizeLabelPhoto,
  callApi: (base64, kind) => callReadLabelApi(base64, kind),
  ocr: (photo) => recognizeText(photo),
  now: () => Date.now(),
};

/** Builds a result from text, applying the retake rule (< 4 ingredients or no commas) to ingredient lists. */
export function buildResult(
  kind: LabelKind,
  source: LabelSource | null,
  fields: { name?: string | null; brand?: string | null; ingredientsText?: string | null },
  meta: { latencyMs?: number; httpStatus?: number | null; usedOcr?: boolean } = {},
): LabelReadResult {
  const base = {
    kind,
    source,
    name: fields.name?.trim() || null,
    brand: fields.brand?.trim() || null,
    latencyMs: meta.latencyMs ?? 0,
    httpStatus: meta.httpStatus ?? null,
    usedOcr: meta.usedOcr ?? false,
  };
  if (kind === 'front') {
    const has = Boolean(base.name || base.brand);
    return { ...base, status: has ? 'ok' : 'manual', ingredientsText: null, parse: null };
  }
  const text = fields.ingredientsText?.trim() || null;
  if (!text) return { ...base, status: 'manual', source: null, ingredientsText: null, parse: null };
  const parse = parseIngredientText(text);
  return { ...base, status: parse.needsRetake ? 'retake' : 'ok', ingredientsText: text, parse };
}

/** She typed the list herself ("type it in"). Same retake rule; she still confirms. */
export function readTypedIngredients(text: string): LabelReadResult {
  return buildResult('ingredients', 'typed', { ingredientsText: text });
}

/** The `status` for the label_read_completed event (events.md). */
export function eventStatus(r: LabelReadResult): LabelEventStatus {
  if (r.status === 'manual') return 'error';
  if (r.usedOcr) return 'ocr-fallback';
  return r.status === 'retake' ? 'retake' : 'ok';
}

/** Latency bucket for label_read_completed. */
export function latencyBucket(ms: number): '<2s' | '2-5s' | '5-10s' | '>10s' {
  return ms < 2000 ? '<2s' : ms < 5000 ? '2-5s' : ms < 10000 ? '5-10s' : '>10s';
}

/**
 * Reads one label photo. Order: resize in the browser -> /api/read-label (timeout, one retry;
 * the server tries Gemini then OpenRouter) -> Tesseract.js in the browser -> status "manual"
 * (the screen shows "type it in"). Never throws. A "retake" result still carries the text so
 * she can see it. Nothing is decided here: she confirms on 04b.
 */
export async function readLabelPhoto(photo: Blob, kind: LabelKind, deps: Partial<ReadDeps> = {}): Promise<LabelReadResult> {
  const d = { ...defaultDeps, ...deps };
  const t0 = d.now();
  let httpStatus: number | null = null;
  let toOcr: Blob = photo;

  try {
    const small = await d.resize(photo);
    toOcr = small.blob;
    const api = await d.callApi(small.base64, kind);
    const r = buildResult(
      kind,
      api.provider === 'openrouter' ? 'openrouter' : 'gemini',
      { name: api.name, brand: api.brand, ingredientsText: api.ingredientsText },
      { httpStatus: 200, latencyMs: d.now() - t0 },
    );
    // An ok reply with nothing usable counts as a failed read: try OCR.
    if (r.status !== 'manual') return r;
  } catch (e) {
    if (e instanceof LabelApiError) httpStatus = e.status || null;
  }

  try {
    const raw = await d.ocr(toOcr, kind);
    const fields = kind === 'front' ? { name: guessNameFromOcr(raw) } : { ingredientsText: extractIngredientsFromOcr(raw) };
    const r = buildResult(kind, 'tesseract', fields, { httpStatus, usedOcr: true, latencyMs: d.now() - t0 });
    if (r.status !== 'manual') return r;
  } catch {
    // OCR failed to load or run (offline, no WASM): fall through to typing.
  }
  return buildResult(kind, null, {}, { httpStatus, latencyMs: d.now() - t0 });
}
