import type { ReviewContext, ShelfItem, ShelfReview } from '../contracts';
import { callReviewTextApi } from '../label/api';

/** Shown as "We couldn't check this one" with Retry; never as Keep (D6). */
export function failedReview(today: string): ShelfReview {
  return { status: 'failed', action: undefined, promptVersion: 'none', reviewedOn: today, culprits: [], mayWorsenDarkness: false };
}

/** Reviews one product from its confirmed text. Never throws. */
export async function reviewShelfItem(
  item: Pick<ShelfItem, 'product' | 'ingredients'>,
  context: ReviewContext,
  today: string,
  deps: { call?: typeof callReviewTextApi; signal?: AbortSignal } = {},
): Promise<ShelfReview> {
  const call = deps.call ?? callReviewTextApi;
  try {
    const res = await call(
      { ingredientsText: item.ingredients.map((i) => i.inci).join(', '), productName: item.product, context },
      deps.signal ? { signal: deps.signal } : {},
    );
    return res.review?.status === 'ok' ? res.review : failedReview(today);
  } catch {
    return failedReview(today);
  }
}
