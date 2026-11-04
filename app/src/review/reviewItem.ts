import type { BodywiseProductId, ReviewContext, ShelfItem, ShelfReview } from '../contracts';
import { callReviewTextApi } from '../label/api';
import { rulesReview } from './rulesReview';

/** Shown as "We couldn't check this one" with Retry; never as Keep (D6). */
export function failedReview(today: string): ShelfReview {
  return { status: 'failed', action: undefined, promptVersion: 'none', reviewedOn: today, culprits: [], mayWorsenDarkness: false };
}

/**
 * Reviews one product from its confirmed text. Never throws. When no AI answers and `anchor` is given, the pair rules
 * answer if one fires (rulesReview); otherwise, or when she cancelled, it is a failed review.
 */
export async function reviewShelfItem(
  item: ShelfItem,
  context: ReviewContext,
  today: string,
  deps: { call?: typeof callReviewTextApi; signal?: AbortSignal; anchor?: BodywiseProductId } = {},
): Promise<ShelfReview> {
  const call = deps.call ?? callReviewTextApi;
  try {
    const res = await call(
      { ingredientsText: item.ingredients.map((i) => i.inci).join(', '), productName: item.product, context },
      deps.signal ? { signal: deps.signal } : {},
    );
    if (res.review?.status === 'ok') return res.review;
  } catch {
    // Network, timeout or every provider down: the rules below.
  }
  if (deps.signal?.aborted || !deps.anchor) return failedReview(today);
  return rulesReview(item, deps.anchor, today) ?? failedReview(today);
}
