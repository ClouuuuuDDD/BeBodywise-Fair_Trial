import { describe, expect, it } from 'vitest';
import { applyRedLines, parseModelJson, validateReview } from '../../../functions/_lib/reviewCheck';

const DISH = 'Linear Alkyl Benzene Sulphonic Acid, Sodium Carbonate, Sodium Silicate, Kaolin, Perfume';
const good = {
  productType: 'household-not-for-skin',
  culprits: [
    { ingredient: 'Sodium Carbonate', concern: 'high-ph-alkali', why: 'A strong alkali that may strip and irritate skin.' },
    { ingredient: 'Sodium Hydroxide', concern: 'high-ph-alkali', why: 'Invented: not on this label.' },
  ],
  mayWorsenDarkness: true,
  darknessWhy: 'Repeated irritation may leave darker marks.',
  action: 'stop-on-skin',
  actionWhy: 'This is made for dishes, not skin.',
  confidence: 'high',
};

describe('parseModelJson', () => {
  it('reads plain and fenced JSON, rejects the rest', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('nope')).toBeNull();
    expect(parseModelJson('[1]')).toBeNull();
  });
});

describe('validateReview', () => {
  it('keeps a valid answer and drops culprits not on the label', () => {
    const r = validateReview(good, DISH)!;
    expect(r.action).toBe('stop-on-skin');
    expect(r.culprits.map((c) => c.ingredient)).toEqual(['Sodium Carbonate']);
  });
  it('matches culprits case-insensitively and across spacing', () => {
    const r = validateReview({ ...good, culprits: [{ ingredient: 'sodium  carbonate', concern: 'high-ph-alkali', why: 'x' }] }, DISH)!;
    expect(r.culprits).toHaveLength(1);
  });
  it('rejects bad enums and missing fields', () => {
    expect(validateReview({ ...good, action: 'fine' }, DISH)).toBeNull();
    expect(validateReview({ ...good, productType: 'soap' }, DISH)).toBeNull();
    expect(validateReview({ ...good, confidence: 'medium' }, DISH)).toBeNull();
    expect(validateReview({ ...good, culprits: [{ ingredient: 'Kaolin', concern: 'dust', why: 'x' }] }, DISH)).toBeNull();
    expect(validateReview({ ...good, mayWorsenDarkness: 'yes' }, DISH)).toBeNull();
  });
  it('trims long text, caps culprits at 8, turns "" into undefined', () => {
    const many = Array.from({ length: 12 }, () => ({ ingredient: 'Kaolin', concern: 'other-irritant', why: 'w'.repeat(300) }));
    const r = validateReview({ ...good, culprits: many, darknessWhy: '', actionWhy: 'a'.repeat(300) }, DISH)!;
    expect(r.culprits).toHaveLength(8);
    expect(r.culprits[0]!.why).toHaveLength(140);
    expect(r.actionWhy).toHaveLength(160);
    expect(r.darknessWhy).toBeUndefined();
  });
});

describe('applyRedLines', () => {
  const keep = { productType: 'body-lotion', culprits: [], mayWorsenDarkness: false, action: 'keep', actionWhy: 'Looks gentle.', confidence: 'high' } as const;
  it('forces ask-doctor for a steroid the AI missed, and names it', () => {
    const r = applyRedLines({ ...keep, culprits: [] }, 'Aqua, Clobetasol Propionate, Glycerin');
    expect(r.action).toBe('ask-doctor');
    expect(r.redLineApplied).toBe(true);
    expect(r.culprits).toEqual([expect.objectContaining({ ingredient: 'Clobetasol Propionate', concern: 'steroid' })]);
    expect(r.actionWhy.length).toBeLessThanOrEqual(160);
  });
  it('covers hydroquinone, bleach and mercury', () => {
    for (const t of ['Aqua, Hydroquinone', 'Aqua, Hydrogen Peroxide', 'Aqua, Ammoniated Mercury']) {
      expect(applyRedLines({ ...keep, culprits: [] }, t).action).toBe('ask-doctor');
    }
  });
  it('leaves an AI ask-doctor alone (no override flag) and ignores clean labels', () => {
    const asked = { ...keep, culprits: [], action: 'ask-doctor' as const, actionWhy: 'AI words.' };
    const out = applyRedLines(asked, 'Aqua, Hydroquinone');
    expect(out.actionWhy).toBe('AI words.');
    expect(out.redLineApplied).toBeUndefined();
    expect(applyRedLines({ ...keep, culprits: [] }, 'Aqua, Glycerin')).toMatchObject({ action: 'keep' });
  });
});
