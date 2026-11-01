/**
 * Output schema for the shelf review (spec 5.3) as standard JSON Schema, strict-mode friendly: every property is
 * required and no extra keys are allowed (an empty string means "none"). No imports (see shelfReviewPrompt.ts).
 * The app's contracts types must stay the same sets (app/src/label/shelfReview.test.ts checks it).
 */
export const PRODUCT_TYPES = [
  'deodorant-antiperspirant', 'body-lotion', 'hair-removal', 'shaving', 'scrub-exfoliant',
  'toner-serum-acid', 'soap-bodywash', 'household-not-for-skin', 'other',
] as const;

export const REVIEW_CONCERNS = [
  'acid', 'retinoid', 'benzoyl-peroxide', 'vitamin-c', 'fragrance', 'essential-oil', 'drying-alcohol',
  'harsh-surfactant', 'high-ph-alkali', 'depilatory', 'antiperspirant', 'physical-scrub', 'bleach',
  'hydroquinone', 'steroid', 'mercury', 'other-irritant',
] as const;

export const REVIEW_ACTIONS = ['keep', 'different-time', 'pause-during-trial', 'stop-on-skin', 'ask-doctor'] as const;

export const CONFIDENCE = ['high', 'low'] as const;

export const REVIEW_LIMITS = { why: 140, actionWhy: 160, darknessWhy: 160, culprits: 8, ingredientsText: 4000 } as const;

/** The review object, with or without the transcription (kind "ingredients" vs "review-text"). */
export function reviewJsonSchema(withTranscription: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    productType: { type: 'string', enum: [...PRODUCT_TYPES] },
    culprits: {
      type: 'array',
      maxItems: REVIEW_LIMITS.culprits,
      items: {
        type: 'object',
        properties: {
          ingredient: { type: 'string' },
          concern: { type: 'string', enum: [...REVIEW_CONCERNS] },
          why: { type: 'string', maxLength: REVIEW_LIMITS.why },
        },
        required: ['ingredient', 'concern', 'why'],
        additionalProperties: false,
      },
    },
    mayWorsenDarkness: { type: 'boolean' },
    darknessWhy: { type: 'string', maxLength: REVIEW_LIMITS.darknessWhy },
    action: { type: 'string', enum: [...REVIEW_ACTIONS] },
    actionWhy: { type: 'string', maxLength: REVIEW_LIMITS.actionWhy },
    confidence: { type: 'string', enum: [...CONFIDENCE] },
  };
  if (withTranscription) properties.ingredientsText = { type: 'string', maxLength: REVIEW_LIMITS.ingredientsText };
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

/** Front of the pack: name and brand only (unchanged task). */
export const FRONT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { name: { type: 'string' }, brand: { type: 'string' } },
  required: ['name', 'brand'],
  additionalProperties: false,
};
