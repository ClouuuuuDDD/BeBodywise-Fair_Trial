import { describe, expect, it } from 'vitest';
import type { ShelfItem, ShelfReview } from '../../contracts';
import { joinNames, needsTrialChoice, openVariables } from '../openVariables';
import { makeShelfItem } from '../shelf';

const review = (over: Partial<ShelfReview>): ShelfReview => ({ status: 'ok', promptVersion: 'shelf-review-v1', reviewedOn: '2026-10-31', culprits: [], mayWorsenDarkness: false, action: 'keep', ...over });
const item = (id: string, over: Partial<ShelfItem> = {}): ShelfItem => ({
  ...makeShelfItem({ id, product: `P-${id}`, source: 'typed', inci: 'Aqua, Glycerin, Parfum, Aloe', areas: ['underarm'], times: 'night' }),
  ...over,
});

describe('openVariables (spec 4)', () => {
  it('kept despite pause or stop, and anything not reviewed ok', () => {
    const shelf = [
      item('a', { review: review({ action: 'pause-during-trial' }), trialChoice: 'keep' }),
      item('b', { review: review({ action: 'pause-during-trial' }), trialChoice: 'pause' }),
      item('c', { review: review({ action: 'stop-on-skin' }), trialChoice: 'keep' }),
      item('d', { review: review({ action: 'keep' }) }),
      item('e', { review: review({ status: 'failed', action: undefined }) }),
      item('f'),
      item('g', { review: review({ action: 'different-time' }), trialChoice: 'keep' }),
    ];
    expect(openVariables(shelf).map((v) => [v.id, v.why])).toEqual([['a', 'kept'], ['c', 'kept'], ['e', 'unchecked'], ['f', 'unchecked']]);
  });
  it('never counts the trial product itself', () => {
    expect(openVariables([item('x', { catalogId: 'bw-rollon-4' })], 'bw-rollon-4')).toEqual([]);
  });
  it('needsTrialChoice only for an ok pause or stop', () => {
    expect(needsTrialChoice(item('a', { review: review({ action: 'pause-during-trial' }) }))).toBe(true);
    expect(needsTrialChoice(item('a', { review: review({ action: 'ask-doctor' }) }))).toBe(false);
    expect(needsTrialChoice(item('a'))).toBe(false);
  });
  it('joins names in plain English', () => {
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
