import { describe, expect, it } from 'vitest';
import type { ProductPick } from '../../../contracts';
import { compareChoice, priceDiffLine, resolveChoice } from './compareChoice';

const pick = (id: ProductPick['pick']): ProductPick => ({ pick: id, ruleRow: 1, baseRow: 1, headline: 'h', why: [], whyNot: [], doctorFirst: false, hormoneNote: false });

describe('compareChoice (spec 3.6)', () => {
  it('same, differs (with the price gap either way), no pick', () => {
    expect(compareChoice('bw-rollon-4', pick('bw-rollon-4'))).toEqual({ kind: 'same', chosen: 'bw-rollon-4' });
    expect(compareChoice('bw-kit-6', pick('bw-rollon-4'))).toEqual({ kind: 'differs', selected: 'bw-kit-6', best: 'bw-rollon-4', priceDiff: 329 - 859 });
    expect(compareChoice('bw-rollon-4', pick('bw-rollon-6'))).toMatchObject({ kind: 'differs', priceDiff: 70 });
    expect(compareChoice('bw-kit-4', pick(null))).toEqual({ kind: 'no-pick', chosen: 'bw-kit-4' });
  });
  it('says the price difference in both directions', () => {
    expect(priceDiffLine('6% roll-on', 70)).toBe('6% roll-on costs Rs 70 more.');
    expect(priceDiffLine('4% roll-on', -530)).toBe('4% roll-on costs Rs 530 less.');
    expect(priceDiffLine('X', 0)).toBe('Same price.');
  });
  it('ties her decision to the exact pair it answered', () => {
    const differs = compareChoice('bw-kit-6', pick('bw-rollon-4'));
    const decision = { selected: 'bw-kit-6', best: 'bw-rollon-4', choice: 'bw-kit-6' } as const;
    expect(resolveChoice(differs, undefined)).toBeUndefined();
    expect(resolveChoice(differs, decision)).toBe('bw-kit-6');
    expect(resolveChoice(compareChoice('bw-kit-6', pick('bw-rollon-6')), decision)).toBeUndefined();
    expect(resolveChoice(compareChoice('bw-kit-6', pick('bw-kit-6')), decision)).toBe('bw-kit-6');
    expect(resolveChoice(compareChoice('bw-kit-6', pick(null)), undefined)).toBe('bw-kit-6');
  });
});
