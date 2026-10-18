import { describe, expect, it } from 'vitest';
import { fit, hormonePattern } from '../fit';
import { makePlanCode } from '../planCode';
import { pairRules } from '../pairRules';
import { pickProduct } from '../pickProduct';
import { RIYA_FIT, riyaShelf } from '../example';
import { fnv1a, rulesVersion } from '../rulesVersion';
import { shade } from '../shade';
import { startPlan } from '../startPlan';
import { item, FIT_MODERATE } from './helpers';

describe('shade', () => {
  it('resolves label and rank from the catalog scale', () => {
    expect(shade('same')).toEqual({ level: 'same', label: 'About the same', rank: 0 });
    expect(shade('mild').label).toBe('A little darker');
    expect(shade('moderate')).toMatchObject({ label: 'Clearly darker', rank: 2 });
    expect(shade('severe')).toMatchObject({ rank: 3 });
    expect(shade('severe').label).toContain('3 or more shades');
  });
});

describe('fit check', () => {
  it('Riya (razor): good fit with the habit line, no hormone note', () => {
    const r = fit(RIYA_FIT);
    expect(r.outcome).toBe('good-with-habit');
    expect(r.habit).toBe('Shaved? Wait 10-15 minutes before the roll-on. If it stings, use it at night instead.');
    expect(r.hormoneNote).toBe(false);
  });

  it('wax and cream give their own gap line', () => {
    expect(fit({ ...RIYA_FIT, hairRemoval: 'wax' }).habit).toBe('Waxed? Wait 6-12 hours before the roll-on.');
    expect(fit({ ...RIYA_FIT, hairRemoval: 'cream' }).habit).toBe('After hair removal cream, wait 2 days before the roll-on.');
  });

  it('laser, none or unanswered: plain good fit, no habit', () => {
    for (const h of ['laser', 'none', undefined] as const) {
      const r = fit({ ...RIYA_FIT, hairRemoval: h });
      expect(r.outcome).toBe('good');
      expect(r.habit).toBeUndefined();
    }
  });

  it('hormone note: the four trigger pairs, and none of the others', () => {
    const triggers: [NonNullable<typeof RIYA_FIT.darkNeck>, NonNullable<typeof RIYA_FIT.regularPeriods>][] = [
      ['yes', 'no'],
      ['yes', 'prefer-not'],
      ['not-sure', 'no'],
      ['not-sure', 'prefer-not'],
    ];
    for (const [darkNeck, regularPeriods] of triggers) {
      expect(fit({ ...RIYA_FIT, darkNeck, regularPeriods }).hormoneNote).toBe(true);
      expect(hormonePattern({ darkNeck, regularPeriods })).toBe(true);
    }
    for (const darkNeck of ['yes', 'no', 'not-sure'] as const) {
      expect(fit({ ...RIYA_FIT, darkNeck, regularPeriods: 'yes' }).hormoneNote).toBe(false);
    }
    expect(fit({ ...RIYA_FIT, darkNeck: 'no', regularPeriods: 'no' }).hormoneNote).toBe(false);
    expect(fit({ ...RIYA_FIT, darkNeck: 'no', regularPeriods: 'prefer-not' }).hormoneNote).toBe(false);
  });

  it('skipped neck or periods never triggers the note', () => {
    expect(fit({ shade: 'moderate' }).hormoneNote).toBe(false);
    expect(fit({ darkNeck: 'yes' }).hormoneNote).toBe(false);
  });
});

describe('start plan (screen 07)', () => {
  const shelf = riyaShelf();
  const answers = pairRules(shelf, 'bw-rollon-4');
  const pick = pickProduct({ fit: RIYA_FIT, shelf, shelfAnswers: answers });
  const plan = startPlan(pick, shelf, answers, RIYA_FIT);

  it("Riya: roll-on at night (No Fragrance), spray kept for mornings, toner face only, cream with a 2 day gap", () => {
    expect(plan.productId).toBe('bw-rollon-4');
    expect(plan.night).toEqual([
      { ref: 'bw-rollon-4', product: '4% AHA BHA Underarm Roll On, No Fragrance', instruction: 'One swipe, on clean, dry skin.' },
    ]);
    expect(plan.morning.map((s) => [s.ref, s.instruction])).toEqual([['riya-spray', 'Your usual deodorant. Mornings only.']]);
    expect(plan.keepApart).toEqual([
      { ref: 'riya-toner', product: 'Glow 7% Glycolic Toner', reason: 'face only while you use the roll-on.' },
      { ref: 'riya-cream', product: 'Silk Hair Removal Cream', reason: 'Wait 2 days after it before the roll-on.' },
    ]);
  });

  it('three rules from config and the once-a-day note (AC-07-2, AC-07-3)', () => {
    expect(plan.rules).toEqual([
      'Shaved? Wait 10-15 minutes. Waxed? Wait 6-12 hours. If it stings, use it at night instead.',
      'Patch test a small spot on your inner arm first, and wait a day.',
      'If your underarms see sun, use sunscreen there.',
    ]);
    expect(plan.rules.join(' ')).not.toContain('24');
    expect(plan.onceADayNote).toBe('Once a day for a fair trial. Bodywise allows twice a day.');
  });

  it('with an empty shelf: nothing else needed in the morning', () => {
    const empty = startPlan(pickProduct({ fit: RIYA_FIT, shelf: [], shelfAnswers: [] }), [], [], RIYA_FIT);
    expect(empty.morning).toHaveLength(1);
    expect(empty.morning[0]?.product).toBe('Nothing else needed.');
    expect(empty.keepApart).toEqual([]);
  });

  it('a kit uses the catalog routine: roll-on in the morning, cream at night', () => {
    const kit = pickProduct({ fit: { ...FIT_MODERATE, shade: 'severe' }, shelf: [], shelfAnswers: [], pregnancy: 'no' });
    const p = startPlan(kit, [], [], FIT_MODERATE);
    expect(p.productId).toBe('bw-kit-4');
    expect(p.morning[0]?.ref).toBe('bw-rollon-4');
    expect(p.night[0]?.ref).toBe('bw-repair-cream');
  });

  it('a steroid goes under keep apart with a doctor line', () => {
    const s = item('c', 'Chemist cream', 'Aqua, Mometasone Furoate, Glycerin, Cetyl Alcohol', ['underarm']);
    const a = pairRules([s], 'bw-rollon-4');
    const p = startPlan(pickProduct({ fit: FIT_MODERATE, shelf: [s], shelfAnswers: a }), [s], a, FIT_MODERATE);
    expect(p.keepApart[0]?.reason).toContain('ask a doctor');
  });

  it('cream users with no cream on the shelf still get the gap rule', () => {
    const p = startPlan(pickProduct({ fit: { ...FIT_MODERATE, hairRemoval: 'cream' }, shelf: [], shelfAnswers: [] }), [], [], {
      ...FIT_MODERATE,
      hairRemoval: 'cream',
    });
    expect(p.rules).toHaveLength(4);
    expect(p.rules[3]).toContain('2 days');
  });
});

describe('plan code and rules version', () => {
  it('makes FT- plus 4 unambiguous characters (AC-05b-7)', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 200; i++) expect(makePlanCode(rng)).toMatch(/^FT-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('rules version is a stable 8 hex characters', () => {
    expect(rulesVersion()).toMatch(/^[0-9a-f]{8}$/);
    expect(rulesVersion()).toBe(rulesVersion());
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
  });
});
