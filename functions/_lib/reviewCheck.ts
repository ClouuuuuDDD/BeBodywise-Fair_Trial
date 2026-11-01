/**
 * Checks a model's review before it reaches her (spec 5.3, 5.4): strict enums, culprits must be on the label,
 * lengths trimmed, then the red lines, the only rules that override the AI.
 */
import { classifyIngredients } from '../../app/src/engine/classifyIngredients';
import { CONFIDENCE, PRODUCT_TYPES, REVIEW_ACTIONS, REVIEW_CONCERNS, REVIEW_LIMITS } from './shelfReviewSchema';

export type ReviewActionOut = (typeof REVIEW_ACTIONS)[number];
export type ReviewConcernOut = (typeof REVIEW_CONCERNS)[number];

export interface ReviewOut {
  productType: (typeof PRODUCT_TYPES)[number];
  culprits: { ingredient: string; concern: ReviewConcernOut; why: string }[];
  mayWorsenDarkness: boolean;
  darknessWhy?: string;
  action: ReviewActionOut;
  actionWhy: string;
  confidence: (typeof CONFIDENCE)[number];
  redLineApplied?: true;
}

/** Model text to an object; tolerates ```json fences. Null when it is not a JSON object. */
export function parseModelJson(text: string): Record<string, unknown> | null {
  let body = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(body);
  if (fenced?.[1]) body = fenced[1];
  try {
    const o: unknown = JSON.parse(body);
    return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Null when any enum or required field is wrong (the chain then tries the next provider). */
export function validateReview(raw: Record<string, unknown>, sourceText: string): ReviewOut | null {
  if (!oneOf(PRODUCT_TYPES, raw.productType) || !oneOf(REVIEW_ACTIONS, raw.action) || !oneOf(CONFIDENCE, raw.confidence)) return null;
  if (typeof raw.mayWorsenDarkness !== 'boolean' || !Array.isArray(raw.culprits)) return null;
  const source = squash(sourceText);
  const culprits: ReviewOut['culprits'] = [];
  for (const c of raw.culprits as unknown[]) {
    const o = (c ?? {}) as Record<string, unknown>;
    if (!oneOf(REVIEW_CONCERNS, o.concern)) return null;
    const ingredient = text(o.ingredient, 120);
    if (ingredient === '' || !source.includes(squash(ingredient))) continue; // never invented
    culprits.push({ ingredient, concern: o.concern, why: text(o.why, REVIEW_LIMITS.why) });
  }
  const darknessWhy = text(raw.darknessWhy, REVIEW_LIMITS.darknessWhy);
  const out: ReviewOut = {
    productType: raw.productType,
    culprits: culprits.slice(0, REVIEW_LIMITS.culprits),
    mayWorsenDarkness: raw.mayWorsenDarkness,
    action: raw.action,
    actionWhy: text(raw.actionWhy, REVIEW_LIMITS.actionWhy),
    confidence: raw.confidence,
  };
  if (darknessWhy !== '') out.darknessWhy = darknessWhy;
  return out;
}

const RED_LINES = ['steroid', 'hydroquinone', 'bleach', 'mercury'] as const;
type RedLine = (typeof RED_LINES)[number];

const RED_LINE_WHY: Record<RedLine, string> = {
  steroid: 'A prescription steroid. On underarms it may thin the skin and darken it.',
  hydroquinone: 'A prescription lightener, meant only with a doctor.',
  bleach: 'A bleach. It is not made for underarm skin.',
  mercury: 'Mercury is not safe on skin.',
};

/** Steroid, hydroquinone, bleach or mercury on the label: ask-doctor, whatever the AI said (spec 5.4). */
export function applyRedLines(review: ReviewOut, sourceText: string): ReviewOut {
  const hits = classifyIngredients(sourceText)
    .map((i) => ({ inci: i.inci, cls: i.classes.find((c): c is RedLine => (RED_LINES as readonly string[]).includes(c)) }))
    .filter((h): h is { inci: string; cls: RedLine } => h.cls !== undefined);
  if (hits.length === 0) return review;
  const culprits = [...review.culprits];
  for (const h of hits) {
    if (!culprits.some((c) => squash(c.ingredient) === squash(h.inci))) culprits.push({ ingredient: h.inci, concern: h.cls, why: RED_LINE_WHY[h.cls] });
  }
  if (review.action === 'ask-doctor') return { ...review, culprits: culprits.slice(0, REVIEW_LIMITS.culprits) };
  const first = hits[0]!;
  return {
    ...review,
    culprits: culprits.slice(0, REVIEW_LIMITS.culprits),
    action: 'ask-doctor',
    actionWhy: `${first.inci} needs a doctor's eye. Please don't use this on your underarms until a doctor has seen the label.`.slice(0, REVIEW_LIMITS.actionWhy),
    redLineApplied: true,
  };
}
