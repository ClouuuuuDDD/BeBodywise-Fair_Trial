import { describe, expect, it, vi } from 'vitest';
import { makeShelfItem } from '../engine';
import { buildReviewContext, failedReview, reviewShelfItem } from './index';

const toner = makeShelfItem({ id: 't', product: 'Glow 7% Glycolic Toner', source: 'label', inci: 'Aqua, Glycolic Acid, Parfum', areas: ['underarm'], times: 'night', stung: true });

describe('buildReviewContext', () => {
  it('sends only shade, duration and hair removal from the fit answers (D7)', () => {
    const c = buildReviewContext({
      target: 'bw-rollon-4',
      fit: { shade: 'moderate', duration: 'year-plus', hairRemoval: 'razor', darkNeck: 'yes', regularPeriods: 'no' },
      shelf: [toner],
      thisProduct: { frontName: 'Dish bar', when: 'morning', stung: false },
    });
    expect(c.her).toEqual({ shade: 'moderate', duration: 'year-plus', hairRemoval: 'razor' });
    expect(Object.keys(c).sort()).toEqual(['her', 'shelfSoFar', 'target', 'thisProduct']);
    expect(c.target.name).toBe('4% AHA BHA Underarm Roll On');
    expect(c.target.ingredients).toContain('Lactic Acid');
    expect(c.shelfSoFar).toEqual([{ name: 'Glow 7% Glycolic Toner', ingredients: 'Aqua, Glycolic Acid, Parfum', when: 'night', stung: true }]);
    expect(JSON.stringify(c)).not.toMatch(/darkNeck|regularPeriods|"id"/);
  });
  it('omits unanswered questions and keeps the context under 15,000 characters', () => {
    const many = Array.from({ length: 12 }, (_, i) => makeShelfItem({ id: `p${i}`, product: `P${i}`, source: 'typed', inci: 'Aqua, '.repeat(600), areas: ['underarm'], times: 'night' }));
    const c = buildReviewContext({ target: 'bw-rollon-4', fit: {}, shelf: many });
    expect(c.her).toEqual({});
    expect(JSON.stringify(c).length).toBeLessThanOrEqual(15_000);
  });
});

describe('reviewShelfItem', () => {
  it('returns the stored review on success and a failed review otherwise (never "keep")', async () => {
    const ctx = buildReviewContext({ target: 'bw-rollon-4', fit: {}, shelf: [] });
    const ok = { status: 'ok', promptVersion: 'shelf-review-v1', reviewedOn: '2026-10-31', culprits: [], mayWorsenDarkness: false, action: 'keep', actionWhy: 'Gentle.', confidence: 'high' } as const;
    const call = vi.fn().mockResolvedValue({ ok: true, kind: 'review-text', provider: 'gemini', review: ok });
    expect(await reviewShelfItem(toner, ctx, '2026-10-31', { call })).toEqual(ok);
    expect(call.mock.calls[0]![0]).toMatchObject({ ingredientsText: 'Aqua, Glycolic Acid, Parfum', productName: 'Glow 7% Glycolic Toner' });
    const failing = vi.fn().mockRejectedValue(new Error('down'));
    expect(await reviewShelfItem(toner, ctx, '2026-10-31', { call: failing })).toEqual(failedReview('2026-10-31'));
    expect(failedReview('2026-10-31')).toMatchObject({ status: 'failed', action: undefined, culprits: [] });
  });
});
