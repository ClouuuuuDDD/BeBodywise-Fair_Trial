import { describe, expect, it, vi } from 'vitest';
import { makeShelfItem } from '../engine';
import { buildReviewContext, failedReview, reviewShelfItem, rulesReview } from './index';

const DAY = '2026-11-04';
const item = (product: string, inci: string) => makeShelfItem({ id: product, product, source: 'label', inci, areas: ['underarm'], times: 'night' });
const toner = item('Glow 7% Glycolic Toner', 'Aqua, Glycolic Acid, Parfum');
const steroid = item('Skin Fair Cream', 'Aqua, Clobetasol Propionate, Cetyl Alcohol');
const cream = item('Hair Off Cream', 'Aqua, Potassium Thioglycolate, Calcium Hydroxide');
const dishwash = item('Dish Bar', 'Sodium Linear Alkylbenzene Sulphonate, Sodium Carbonate, Calcite, Perfume');
const lotion = item('Soft Lotion', 'Aqua, Glycerin, Niacinamide, Dimethicone');

describe('rulesReview (fallback when no AI answers)', () => {
  it('an acid next to the AHA BHA roll-on: pause, from the pair rule, with the acid as culprit', () => {
    const r = rulesReview(toner, 'bw-rollon-4', DAY)!;
    expect(r).toMatchObject({ status: 'ok', provider: 'rules', action: 'pause-during-trial', confidence: 'low', reviewedOn: DAY, mayWorsenDarkness: false });
    expect(r.actionWhy).toMatch(/glycolic acid/i);
    expect(r.culprits[0]).toMatchObject({ ingredient: 'Glycolic Acid', concern: 'acid' });
    expect(r.promptVersion).toMatch(/^rules-/);
  });

  it('a steroid: ask a doctor', () => {
    expect(rulesReview(steroid, 'bw-rollon-4', DAY)).toMatchObject({ action: 'ask-doctor', culprits: [{ ingredient: 'Clobetasol Propionate', concern: 'steroid' }] });
  });

  it('a hair removal cream with the acid roll-on: a different time (leave a gap)', () => {
    expect(rulesReview(cream, 'bw-rollon-4', DAY)).toMatchObject({ action: 'different-time' });
  });

  it('stung makes a "different time" answer at least a pause', () => {
    const stung = { ...cream, stung: true };
    expect(rulesReview(stung, 'bw-rollon-4', DAY)).toMatchObject({ action: 'pause-during-trial' });
  });

  it('no rule fires: no answer, so it is never shown as Keep (a dishwash bar is not "fine")', () => {
    expect(rulesReview(dishwash, 'bw-rollon-4', DAY)).toBeNull();
    expect(rulesReview(lotion, 'bw-rollon-4', DAY)).toBeNull();
  });

  it('culprits are only ingredients on her label, at most the review cap', () => {
    const r = rulesReview(toner, 'bw-rollon-4', DAY)!;
    for (const c of r.culprits) expect(toner.ingredients.map((i) => i.inci)).toContain(c.ingredient);
  });
});

describe('reviewShelfItem with the rules fallback', () => {
  const ctx = buildReviewContext({ target: 'bw-rollon-4', fit: {}, shelf: [] });
  const down = () => vi.fn().mockRejectedValue(new Error('down'));

  it('AI down: the pair rules answer when one fires', async () => {
    expect(await reviewShelfItem(toner, ctx, DAY, { call: down(), anchor: 'bw-rollon-4' })).toMatchObject({ status: 'ok', provider: 'rules', action: 'pause-during-trial' });
  });

  it('AI down and no rule fires: failed, with Retry', async () => {
    expect(await reviewShelfItem(dishwash, ctx, DAY, { call: down(), anchor: 'bw-rollon-4' })).toEqual(failedReview(DAY));
  });

  it('an ok AI answer always wins over the rules', async () => {
    const ok = { status: 'ok', provider: 'gemini', promptVersion: 'v', reviewedOn: DAY, culprits: [], mayWorsenDarkness: false, action: 'stop-on-skin', actionWhy: 'x', confidence: 'high' } as const;
    const call = vi.fn().mockResolvedValue({ ok: true, kind: 'review-text', provider: 'gemini', review: ok });
    expect(await reviewShelfItem(toner, ctx, DAY, { call, anchor: 'bw-rollon-4' })).toEqual(ok);
  });

  it('she cancelled ("check later"): failed, not the rules', async () => {
    const abort = new AbortController();
    abort.abort();
    expect(await reviewShelfItem(toner, ctx, DAY, { call: down(), anchor: 'bw-rollon-4', signal: abort.signal })).toEqual(failedReview(DAY));
  });

  it('without an anchor: failed as before', async () => {
    expect(await reviewShelfItem(toner, ctx, DAY, { call: down() })).toEqual(failedReview(DAY));
  });
});
