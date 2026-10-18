import { describe, expect, it } from 'vitest';
import type { BodywiseProductId, FitAnswers, PickInput, ShelfItem } from '../../contracts';
import { RIYA_FIT, riyaShelf } from '../example';
import { pairRules } from '../pairRules';
import { pickProduct, pregnancyQuestionNeeded } from '../pickProduct';
import { shelfItemFromCatalog } from '../shelf';
import { FIT_MODERATE, item } from './helpers';

function input(fitAnswers: FitAnswers, shelf: ShelfItem[] = [], extra: Partial<PickInput> = {}): PickInput {
  return { fit: fitAnswers, shelf, shelfAnswers: pairRules(shelf, 'bw-rollon-4'), ...extra };
}

const ALL: BodywiseProductId[] = ['bw-rollon-4', 'bw-rollon-6', 'bw-kit-4', 'bw-repair-cream', 'bw-kit-6'];
const faceToner = item('t', 'Glow toner', 'Aqua, Glycolic Acid, Witch Hazel, Glycerin', ['face']);
const stungSpray = item('s', 'Fresh Bloom spray', 'Alcohol Denat., Butane, Aluminium Chlorohydrate, Parfum', ['underarm'], 'morning', { stung: true });

function expectRangeCovered(p: ReturnType<typeof pickProduct>) {
  const ids = [...(p.pick ? [p.pick] : []), ...p.whyNot.map((w) => w.productId)].sort();
  expect(ids).toEqual([...ALL].sort());
  for (const w of p.whyNot) {
    expect(w.line.length).toBeGreaterThan(0);
    expect(w.priceInr).toBeGreaterThan(0);
  }
}

describe("pick: Riya's worked example (spec)", () => {
  const shelf = riyaShelf();
  const p = pickProduct(input(RIYA_FIT, shelf));

  it('picks the 4% roll-on, No Fragrance, Rs 329, by row 8', () => {
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.variant).toBe('no-fragrance');
    expect(p.priceInr).toBe(329);
    expect(p.ruleRow).toBe(8);
    expect(p.doctorFirst).toBe(false);
    expect(p.hormoneNote).toBe(false);
  });

  it('gives three reasons that name her answers', () => {
    expect(p.why).toHaveLength(3);
    expect(p.why[0]).toBe('Clearly darker, not 3+ shades: a roll-on is enough.');
    expect(p.why[1]).toContain('Fresh Bloom Deo Spray stung you once');
    expect(p.why[2]).toContain('hair removal cream');
  });

  it('lists the four other products with prices, 6% first (AC-05b-3)', () => {
    expect(p.whyNot.map((w) => [w.productId, w.priceInr])).toEqual([
      ['bw-rollon-6', 399],
      ['bw-kit-4', 799],
      ['bw-repair-cream', 549],
      ['bw-kit-6', 859],
    ]);
    expect(p.whyNot[0]?.line).toBe('Step up at week 8 if your skin is calm but change is slow.');
    expect(p.whyNot[1]?.line).toBe('For 3+ shades darker. Adds a retinol night cream.');
    expect(p.whyNot[2]?.line).toContain('You said smell');
    expectRangeCovered(p);
  });

  it('does not ask the pregnancy question', () => {
    expect(pregnancyQuestionNeeded(input(RIYA_FIT, shelf))).toBe(false);
  });

  it('B9: her toner on face AND underarms does not trigger row 3', () => {
    expect(p.ruleRow).not.toBe(3);
  });
});

describe('pick table, one test per row', () => {
  it('row 1: steroid on underarms -> no pick, sort first, doctor first, every line "after you have stopped"', () => {
    const steroid = item('c', 'Chemist cream', 'Aqua, Mometasone Furoate, Propylene Glycol, Cetyl Alcohol', ['underarm']);
    const p = pickProduct(input(RIYA_FIT, [...riyaShelf(), steroid]));
    expect(p.pick).toBeNull();
    expect(p.noPickReason).toBe('sort-first');
    expect(p.ruleRow).toBe(1);
    expect(p.doctorFirst).toBe(true);
    expect(p.whyNot).toHaveLength(5);
    expect(p.whyNot.every((w) => w.line === "After you've stopped Chemist cream.")).toBe(true);
    expectRangeCovered(p);
  });

  it('row 1: hydroquinone and bleach also stop the pick', () => {
    const hq = item('h', 'Fade cream', 'Aqua, Hydroquinone, Glycerin, Cetyl Alcohol', ['underarm']);
    const bl = item('b', 'Bleach kit', 'Aqua, Hydrogen Peroxide, Glycerin, Cetyl Alcohol', ['underarm']);
    expect(pickProduct(input(FIT_MODERATE, [hq])).ruleRow).toBe(1);
    expect(pickProduct(input(FIT_MODERATE, [bl])).ruleRow).toBe(1);
  });

  it('row 2: already owns a Bodywise roll-on -> start the Fair Trial with it', () => {
    const own = shelfItemFromCatalog('bw-rollon-6', { areas: ['underarm'], times: 'night' });
    const p = pickProduct(input(FIT_MODERATE, [own]));
    expect(p.pick).toBe('bw-rollon-6');
    expect(p.ruleRow).toBe(2);
    expect(p.headline).toBe('You already have it. Start your Fair Trial with it.');
    expectRangeCovered(p);
  });

  it('row 2: owning a kit counts; owning only the cream does not', () => {
    const kit = shelfItemFromCatalog('bw-kit-4', { areas: ['underarm'], times: 'night' });
    expect(pickProduct(input(FIT_MODERATE, [kit])).pick).toBe('bw-kit-4');
    const cream = shelfItemFromCatalog('bw-repair-cream', { areas: ['neck'], times: 'night' });
    expect(pickProduct(input(FIT_MODERATE, [cream])).ruleRow).not.toBe(2);
  });

  it('row 3: another acid on underarms only -> do not stack, roll-on pick', () => {
    const only = item('t', 'Glow toner', 'Aqua, Glycolic Acid, Witch Hazel, Glycerin', ['underarm']);
    const p = pickProduct(input(FIT_MODERATE, [only]));
    expect(p.ruleRow).toBe(3);
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.headline).toBe("Don't stack acids.");
    expect(p.why[0]).toBe('Finish a fair trial of Glow toner, or switch to the roll-on and stop it.');
    expectRangeCovered(p);
  });

  it('row 4: about the same -> no pick, "may not need it", deodorant line, all five listed', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, shade: 'same' }));
    expect(p.pick).toBeNull();
    expect(p.noPickReason).toBe('may-not-need');
    expect(p.ruleRow).toBe(4);
    expect(p.headline).toBe('For darkness, you may not need it.');
    expect(p.why).toEqual(['If smell is the reason, the 4% roll-on works as a deodorant.']);
    expect(p.whyNot).toHaveLength(5);
    expectRangeCovered(p);
  });

  it('row 5: much darker and not pregnant -> the 4% kit, Rs 799', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, shade: 'severe' }, [], { pregnancy: 'no' }));
    expect(p.pick).toBe('bw-kit-4');
    expect(p.ruleRow).toBe(5);
    expect(p.priceInr).toBe(799);
    expect(p.whyNot.find((w) => w.productId === 'bw-rollon-6')?.line).toBe('On its own may not be enough at 3+ shades.');
    expect(p.whyNot.find((w) => w.productId === 'bw-kit-6')?.line).toContain('Step up only if the kit is gentle on you but slow at week 8');
    expectRangeCovered(p);
  });

  it('row 6: much darker and pregnant, or prefer not to say -> 4% No Fragrance, doctor first, kits have retinol (AC-05b-4)', () => {
    for (const pregnancy of ['yes', 'prefer-not'] as const) {
      const p = pickProduct(input({ ...FIT_MODERATE, shade: 'severe' }, [], { pregnancy }));
      expect(p.pick).toBe('bw-rollon-4');
      expect(p.variant).toBe('no-fragrance');
      expect(p.ruleRow).toBe(6);
      expect(p.doctorFirst).toBe(true);
      for (const id of ['bw-kit-4', 'bw-kit-6', 'bw-repair-cream'] as const) {
        expect(p.whyNot.find((w) => w.productId === id)?.line).toBe('Has retinol. Ask a doctor first.');
      }
      expectRangeCovered(p);
    }
  });

  it('row 6 until she answers: no retinol product is recommended, and the screen is told to ask', () => {
    const i = input({ ...FIT_MODERATE, shade: 'severe' });
    expect(pregnancyQuestionNeeded(i)).toBe(true);
    expect(pickProduct(i).ruleRow).toBe(6);
    expect(pregnancyQuestionNeeded({ ...i, pregnancy: 'no' })).toBe(false);
  });

  it('row 7: clearly darker, no sting, has used acids -> 6% roll-on, Rs 399', () => {
    const p = pickProduct(input(FIT_MODERATE, [faceToner]));
    expect(p.pick).toBe('bw-rollon-6');
    expect(p.ruleRow).toBe(7);
    expect(p.priceInr).toBe(399);
    expect(p.variant).toBeUndefined();
    expect(p.whyNot.find((w) => w.productId === 'bw-rollon-4')?.line).toBe("Gentler, if you'd rather start soft.");
    expect(p.whyNot.find((w) => w.productId === 'bw-kit-4')?.line).toBe('For 3+ shades darker.');
    expectRangeCovered(p);
  });

  it('row 7 suggests No Fragrance when she keeps a fragranced spray', () => {
    const spray = item('s', 'Fresh Bloom spray', 'Alcohol Denat., Butane, Aluminium Chlorohydrate, Parfum', ['underarm'], 'morning');
    const p = pickProduct(input(FIT_MODERATE, [faceToner, spray]));
    expect(p.ruleRow).toBe(7);
    expect(p.variant).toBe('no-fragrance');
  });

  it('row 8: clearly darker but stung -> 4% No Fragrance', () => {
    const p = pickProduct(input(FIT_MODERATE, [faceToner, stungSpray]));
    expect(p.ruleRow).toBe(8);
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.variant).toBe('no-fragrance');
  });

  it('row 8: clearly darker and new to acids -> 4%, regular fragrance choice', () => {
    const p = pickProduct(input(FIT_MODERATE));
    expect(p.ruleRow).toBe(8);
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.variant).toBeUndefined();
    expect(p.why).toContain("You haven't used exfoliating acids before, so start gentle.");
  });

  it('row 8: clearly darker, used acids, no sting, but uses hair removal cream -> 4%', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, hairRemoval: 'cream' }, [faceToner]));
    expect(p.ruleRow).toBe(8);
    expect(p.pick).toBe('bw-rollon-4');
  });

  it('row 9: a little darker -> 4% roll-on, 6% is "more than you need"', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, shade: 'mild' }));
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.ruleRow).toBe(9);
    expect(p.priceInr).toBe(329);
    expect(p.whyNot.find((w) => w.productId === 'bw-rollon-6')?.line).toBe('More than you need.');
    expectRangeCovered(p);
  });

  it('a missing shade is treated as "a little darker"', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, shade: undefined }));
    expect(p.ruleRow).toBe(9);
  });

  it('first match wins: a steroid beats an owned roll-on, an owned roll-on beats stacking', () => {
    const steroid = item('c', 'Chemist cream', 'Aqua, Clobetasol Propionate, Glycerin, Cetyl Alcohol', ['underarm']);
    const own = shelfItemFromCatalog('bw-rollon-4', { areas: ['underarm'], times: 'night' });
    const stack = item('t', 'Glow toner', 'Aqua, Glycolic Acid, Witch Hazel, Glycerin', ['underarm']);
    expect(pickProduct(input(FIT_MODERATE, [own, steroid])).ruleRow).toBe(1);
    expect(pickProduct(input(FIT_MODERATE, [stack, own])).ruleRow).toBe(2);
    expect(pickProduct(input({ ...FIT_MODERATE, shade: 'same' }, [stack])).ruleRow).toBe(3);
  });
});

describe('pick table: the antiperspirant add-on and the hormone note', () => {
  it('sweat antiperspirant she will not give up, clearly darker, pregnancy no -> also offer the cream (Rs 549 at night)', () => {
    const p = pickProduct(input(FIT_MODERATE, [], { keepsAntiperspirantForSweat: true, pregnancy: 'no' }));
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.alsoOffer).toBe('bw-repair-cream');
    expect(p.ruleRow).toBe('extra-cream');
    expect(p.baseRow).toBeGreaterThanOrEqual(5);
    expect(p.baseRow).toBeLessThanOrEqual(9);
  });

  it('the cream has retinol, so no add-on until pregnancy is answered no; the screen is told to ask', () => {
    const i = input(FIT_MODERATE, [], { keepsAntiperspirantForSweat: true });
    expect(pickProduct(i).alsoOffer).toBeUndefined();
    expect(pregnancyQuestionNeeded(i)).toBe(true);
    expect(pickProduct({ ...i, pregnancy: 'prefer-not' }).alsoOffer).toBeUndefined();
  });

  it('no add-on for a little darker', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, shade: 'mild' }, [], { keepsAntiperspirantForSweat: true, pregnancy: 'no' }));
    expect(p.alsoOffer).toBeUndefined();
  });

  it('hormone note rides on the pick, never blocks it', () => {
    const p = pickProduct(input({ ...FIT_MODERATE, darkNeck: 'yes', regularPeriods: 'no' }));
    expect(p.hormoneNote).toBe(true);
    expect(p.pick).toBe('bw-rollon-4');
    expect(p.doctorFirst).toBe(false);
  });
});
