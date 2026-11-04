import type { ReviewAction, ShelfItem } from '../../../contracts';

/** Action chip labels (spec 3.5). */
export const ACTION_LABEL: Record<ReviewAction, string> = {
  keep: 'Keep',
  'different-time': 'Different time',
  'pause-during-trial': 'Pause during your trial',
  'stop-on-skin': 'Stop using on skin',
  'ask-doctor': 'Ask a doctor',
};

export const REVIEW_COPY = {
  lead: 'Each label checked against your pick and your answers.',
  culprits: 'Because of',
  darkness: 'May be adding to your darkness',
  lowConfidence: "Our reader wasn't sure about this one.",
  byRules: 'Checked by our draft ingredient rules. The AI reader was busy.',
  retryAi: 'Check with AI',
  failed: "We couldn't check this one.",
  retry: 'Retry',
  unchecked: 'Not checked yet',
  checking: 'Checking…',
  checkingLine: 'Checking it against your plan.',
} as const;

const RANK: Record<ReviewAction | 'unchecked', number> = {
  'ask-doctor': 0, 'stop-on-skin': 1, 'pause-during-trial': 2, 'different-time': 3, unchecked: 4, keep: 5,
};
const rankOf = (i: ShelfItem) => (i.review?.status === 'ok' && i.review.action ? RANK[i.review.action] : RANK.unchecked);

/** Most cautious first; ties keep the order she added them. */
export function orderForReview(shelf: ShelfItem[]): ShelfItem[] {
  return shelf.map((item, n) => ({ item, n })).sort((a, b) => rankOf(a.item) - rankOf(b.item) || a.n - b.n).map((x) => x.item);
}

export function reviewSummary(shelf: ShelfItem[], checking = 0): string {
  if (shelf.length === 0) return 'Nothing else on your shelf. Simple start.';
  if (checking > 0) return checking === 1 ? 'Checking one product…' : `Checking ${checking} products…`;
  const unchecked = shelf.filter((i) => i.review?.status !== 'ok').length;
  const changes = shelf.filter((i) => i.review?.status === 'ok' && i.review.action !== 'keep').length;
  if (changes === 0 && unchecked === 0) return 'All fine together.';
  if (changes === 0) return unchecked === 1 ? "One product isn't checked yet." : `${unchecked} products aren't checked yet.`;
  return changes === 1 ? 'One product needs a change for your trial.' : `${changes} products need a change for your trial.`;
}
