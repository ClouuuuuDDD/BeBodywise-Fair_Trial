/**
 * Label reader, client side. Owner: E6. No barcode in v1 (BARCODE_ENABLED = false).
 * Resize to LABEL_MAX_EDGE_PX JPEG -> POST /api/read-label (Gemini, then OpenRouter, server side)
 * -> Tesseract.js in the browser -> "type it in". Ingredient text goes through the engine
 * (classifyIngredients) with the retake rule. She confirms before any rule runs.
 * Screens 04a/04b (E4) call readLabelPhoto / useLabelRead; see engineering/notes/label-reading.md.
 */
export { readLabelPhoto, readTypedIngredients, buildResult, eventStatus, latencyBucket } from './readLabel';
export { useLabelRead } from './useLabelRead';
export type { LabelReadState } from './useLabelRead';
export { LABEL_FIXTURES, getFixture, cachedRead } from './fixtures';
export type { LabelFixture } from './fixtures';
export { resizeLabelPhoto, targetSize } from './resize';
export { callReadLabelApi, LabelApiError } from './api';
export { extractIngredientsFromOcr } from './ocr';
export type {
  LabelKind,
  LabelReadResult,
  LabelReadStatus,
  LabelEventStatus,
  LabelSource,
  ReadLabelApiResponse,
} from './types';
