import { describe, expect, it } from 'vitest';
import type { ShelfItem, ShelfReview } from '../../../contracts';
import { REVIEW_ACTIONS } from '../../../../../functions/_lib/shelfReviewSchema';
import { makeShelfItem } from '../../../engine';
import { ACTION_LABEL, orderForReview, reviewSummary } from './reviewCopy';

const r = (over: Partial<ShelfReview>): ShelfReview => ({ status: 'ok', promptVersion: 'v', reviewedOn: '2026-10-31', culprits: [], mayWorsenDarkness: false, action: 'keep', ...over });
const it_ = (id: string, review?: ShelfReview): ShelfItem => ({ ...makeShelfItem({ id, product: id, source: 'typed', inci: 'Aqua, Glycerin', areas: ['underarm'], times: 'night' }), ...(review ? { review } : {}) });

describe('05 review copy', () => {
  it('has a label for every action', () => {
    expect(Object.keys(ACTION_LABEL).sort()).toEqual([...REVIEW_ACTIONS].sort());
    expect(ACTION_LABEL['pause-during-trial']).toBe('Pause during your trial');
  });
  it('orders the most cautious first, unchecked before keep', () => {
    const shelf = [it_('k', r({})), it_('u'), it_('p', r({ action: 'pause-during-trial' })), it_('d', r({ action: 'ask-doctor' })), it_('t', r({ action: 'different-time' }))];
    expect(orderForReview(shelf).map((i) => i.id)).toEqual(['d', 'p', 't', 'u', 'k']);
  });
  it('summarises without ever calling an unchecked product fine', () => {
    expect(reviewSummary([])).toBe('Nothing else on your shelf. Simple start.');
    expect(reviewSummary([it_('a', r({}))])).toBe('All fine together.');
    expect(reviewSummary([it_('a', r({})), it_('b')])).toBe("One product isn't checked yet.");
    expect(reviewSummary([it_('a', r({})), it_('b')], 1)).toBe('Checking one product…');
    expect(reviewSummary([it_('a'), it_('b')], 2)).toBe('Checking 2 products…');
    expect(reviewSummary([it_('a', r({ action: 'stop-on-skin' })), it_('b', r({ action: 'pause-during-trial' }))])).toBe('2 products need a change for your trial.');
  });
});
