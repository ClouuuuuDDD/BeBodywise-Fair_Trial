import type { BodywiseProductId, IngredientClass, ReviewAction, ReviewConcern, ReviewCulprit, ShelfAnswerKind, ShelfItem, ShelfReview } from '../contracts';
import { pairRules, rulesVersion } from '../engine';
import { ingredientRules } from '../engine/data';

/**
 * The fallback when no AI provider answers: the pair rules in ingredient-rules.json (draft dermatologist rules,
 * the same ones the shelf screen used before the AI review). They only know pairs and red lines, not household
 * products, so "fine" (no rule fired) gives no answer and the product stays "We couldn't check this one" (D6:
 * a failed check is never shown as Keep). A rules answer says so on screen (provider "rules").
 */
const ACTION: Record<ShelfAnswerKind, ReviewAction | null> = {
  'stop-ask': 'ask-doctor',
  'pick-one': 'pause-during-trial',
  'split-time': 'different-time',
  wait: 'different-time',
  fine: null,
};

const CONCERN: Partial<Record<IngredientClass, ReviewConcern>> = {
  aha: 'acid',
  bha: 'acid',
  pha: 'acid',
  retinoid: 'retinoid',
  'benzoyl-peroxide': 'benzoyl-peroxide',
  'vitamin-c-pure': 'vitamin-c',
  steroid: 'steroid',
  hydroquinone: 'hydroquinone',
  bleach: 'bleach',
  mercury: 'mercury',
  depilatory: 'depilatory',
  antiperspirant: 'antiperspirant',
  'drying-alcohol': 'drying-alcohol',
  fragrance: 'fragrance',
  'physical-scrub': 'physical-scrub',
};

/** Same caps as the server's check (functions/_lib/shelfReviewSchema.ts REVIEW_LIMITS). */
const MAX_CULPRITS = 8;
const MAX_WHY = 140;

const labelOf = (cls: IngredientClass): string => (ingredientRules.classes as Record<string, { label: string }>)[cls]?.label ?? cls;

/** A review from the pair rules for one product against the anchor, or null when no rule fires. Pure. */
export function rulesReview(item: ShelfItem, anchor: BodywiseProductId, today: string): ShelfReview | null {
  const row = pairRules([item], anchor)[0];
  const action = row ? ACTION[row.answer] : null;
  if (!row || !action) return null;

  const culprits: ReviewCulprit[] = [];
  for (const ing of item.ingredients) {
    const cls = ing.classes.find((c) => CONCERN[c] !== undefined);
    if (!cls) continue;
    culprits.push({ ingredient: ing.inci, concern: CONCERN[cls]!, why: labelOf(cls).slice(0, MAX_WHY) });
  }
  // The ingredient the deciding rule names goes first, so the cap never cuts it.
  culprits.sort((a, b) => Number(b.ingredient === row.ingredient) - Number(a.ingredient === row.ingredient));

  return {
    status: 'ok',
    provider: 'rules',
    model: row.ruleId,
    promptVersion: `rules-${rulesVersion()}`,
    reviewedOn: today,
    culprits: culprits.slice(0, MAX_CULPRITS),
    mayWorsenDarkness: false,
    action,
    actionWhy: row.reason, // our own rule copy, not model output: shown whole
    confidence: 'low',
  };
}
