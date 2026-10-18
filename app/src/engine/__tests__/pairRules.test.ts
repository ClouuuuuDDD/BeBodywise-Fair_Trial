import { describe, expect, it } from 'vitest';
import { pairRules } from '../pairRules';
import { riyaShelf } from '../example';
import { shelfItemFromCatalog } from '../shelf';
import { item } from './helpers';

const byId = (rows: ReturnType<typeof pairRules>, id: string) => rows.find((r) => r.itemId === id)!;

describe("pair rules: Riya's four shelf rows against the 4% roll-on", () => {
  const rows = pairRules(riyaShelf(), 'bw-rollon-4');

  it('Glow toner (face + underarms): Pick one here, both acids, names the product and glycolic acid', () => {
    const r = byId(rows, 'riya-toner');
    expect(r.answer).toBe('pick-one');
    expect(r.ruleId).toBe('acid-acid');
    expect(r.ingredient).toBe('Glycolic Acid');
    expect(r.reason).toContain('Glow 7% Glycolic Toner');
    expect(r.reason).toContain('glycolic acid');
    expect(r.reason).toMatch(/can stay on your face/);
  });

  it('Fresh Bloom spray: Different times, no number of hours (AC-05-3), smell line', () => {
    const r = byId(rows, 'riya-spray');
    expect(r.answer).toBe('split-time');
    expect(r.ruleId).toBe('acid-alcohol-spray');
    expect(r.ingredient).toBe('Alcohol Denat.');
    expect(r.reason).toContain('Fresh Bloom Deo Spray');
    expect(r.reason).toContain('You may not need both.');
    expect(r.reason).not.toMatch(/\d+\s*hours?/i);
  });

  it('Silk cream: Leave a gap of 2 days', () => {
    const r = byId(rows, 'riya-cream');
    expect(r.answer).toBe('wait');
    expect(r.ruleId).toBe('acid-depilatory');
    expect(r.ingredient).toBe('Potassium Thioglycolate');
    expect(r.reason).toContain('Silk Hair Removal Cream');
    expect(r.reason).toContain('2 days');
  });

  it('Niacinamide body lotion: Fine together', () => {
    const r = byId(rows, 'riya-lotion');
    expect(r.answer).toBe('fine');
    expect(r.ruleId).toBe('brightener-any');
    expect(r.ingredient).toBe('Niacinamide');
  });

  it('keeps shelf order when nothing needs a doctor', () => {
    expect(rows.map((r) => r.itemId)).toEqual(['riya-toner', 'riya-spray', 'riya-cream', 'riya-lotion']);
  });
});

describe('pair rules by area', () => {
  it('a glycolic toner used only on the face is never Pick one here (AC-05-4)', () => {
    const toner = item('t', 'Glow toner', 'Aqua, Glycolic Acid, Glycerin, Parfum', ['face']);
    const r = pairRules([toner], 'bw-rollon-4')[0]!;
    expect(r.answer).toBe('fine');
    expect(r.ruleId).toBe('soothing-any');
  });

  it('a face-only product with no matching class gets a plain fine row', () => {
    const r = pairRules([item('t', 'Glow toner', 'Aqua, Glycolic Acid, Witch Hazel, Parfum', ['face'])], 'bw-rollon-4')[0]!;
    expect(r.answer).toBe('fine');
    expect(r.ruleId).toBe('not-on-underarms');
  });

  it('an acid used on underarms only: Pick one here, with the "finish a fair trial" line', () => {
    const r = pairRules([item('t', 'Glow toner', 'Aqua, Glycolic Acid, Witch Hazel, Parfum', ['underarm'])], 'bw-rollon-4')[0]!;
    expect(r.answer).toBe('pick-one');
    expect(r.reason).toContain('Finish a fair trial of Glow toner');
  });

  it('a prescription steroid on underarms: Stop and ask a doctor, listed first (AC-05-5)', () => {
    const shelf = [
      ...riyaShelf(),
      item('s', 'Chemist cream', 'Aqua, Mometasone Furoate, Propylene Glycol, Cetyl Alcohol', ['underarm']),
    ];
    const rows = pairRules(shelf, 'bw-rollon-4');
    expect(rows[0]?.itemId).toBe('s');
    expect(rows[0]?.answer).toBe('stop-ask');
    expect(rows[0]?.priority).toBe(1);
    expect(rows[0]?.reason).toContain('Mometasone Furoate');
  });

  it('the same steroid on the face only is not a stop', () => {
    const r = pairRules([item('s', 'Chemist cream', 'Aqua, Mometasone Furoate, Propylene Glycol, Cetyl Alcohol', ['face'])], 'bw-rollon-4')[0]!;
    expect(r.answer).not.toBe('stop-ask');
  });

  it('hydroquinone and bleach on underarms both stop', () => {
    const hq = item('h', 'Fade cream', 'Aqua, Hydroquinone, Glycerin, Cetyl Alcohol', ['underarm']);
    const bl = item('b', 'Bleach kit', 'Aqua, Hydrogen Peroxide, Glycerin, Cetyl Alcohol', ['underarm']);
    const rows = pairRules([hq, bl], 'bw-rollon-4');
    expect(rows.map((r) => r.ruleId)).toEqual(['hydroquinone', 'bleach']);
  });
});

describe('pair rules: time handling (decisions B9)', () => {
  it('Different times fires even when she already splits them', () => {
    const retinol = item('r', 'Night serum', 'Aqua, Retinol, Glycerin, Squalane', ['underarm'], 'morning');
    const night = item('r2', 'Night serum', 'Aqua, Retinol, Glycerin, Squalane', ['underarm'], 'night');
    expect(pairRules([retinol], 'bw-rollon-4')[0]?.answer).toBe('split-time');
    expect(pairRules([night], 'bw-rollon-4')[0]?.answer).toBe('split-time');
  });

  it('benzoyl peroxide and pure vitamin C on underarms are Different times', () => {
    const bpo = item('b', 'Spot gel', 'Aqua, Benzoyl Peroxide, Glycerin, Carbomer', ['underarm']);
    const vc = item('v', 'C serum', 'Aqua, L-Ascorbic Acid, Glycerin, Ferulic Acid', ['underarm'], 'morning');
    expect(pairRules([bpo, vc], 'bw-rollon-4').map((r) => r.answer)).toEqual(['split-time', 'split-time']);
  });

  it('a scrub on underarms is Pick one here', () => {
    const scrub = item('s', 'Body scrub', 'Aqua, Walnut Shell Powder, Glycerin, Parfum', ['underarm']);
    expect(pairRules([scrub], 'bw-rollon-4')[0]?.answer).toBe('pick-one');
  });
});

describe('pair rules: antiperspirant (sweat or smell)', () => {
  const ap = (answer?: 'sweat' | 'smell' | 'both') =>
    item('a', 'Dry Guard stick', 'Cyclopentasiloxane, Aluminium Chlorohydrate, Stearyl Alcohol, Talc', ['underarm'], 'morning', {
      antiperspirantFor: answer,
    });

  it('smell: you may not need both, no hours claimed', () => {
    const r = pairRules([ap('smell')], 'bw-rollon-4')[0]!;
    expect(r.answer).toBe('split-time');
    expect(r.ruleId).toBe('rollon-antiperspirant');
    expect(r.reason).toBe('The roll-on also works as a deodorant. You may not need both.');
  });

  it('sweat: keep it for the morning', () => {
    const r = pairRules([ap('sweat')], 'bw-rollon-4')[0]!;
    expect(r.reason).toContain('Keep Dry Guard stick for the morning');
  });

  it('applies to a kit anchor too (it contains a roll-on) but not to the cream alone', () => {
    expect(pairRules([ap('sweat')], 'bw-kit-4')[0]?.ruleId).toBe('rollon-antiperspirant');
    expect(pairRules([ap('sweat')], 'bw-repair-cream')[0]?.ruleId).not.toBe('rollon-antiperspirant');
  });
});

describe('pair rules: Bodywise products on the shelf', () => {
  it('the anchor itself gets a plain fine row', () => {
    const own = shelfItemFromCatalog('bw-rollon-4', { areas: ['underarm'], times: 'night' });
    expect(pairRules([own], 'bw-rollon-4')[0]?.ruleId).toBe('anchor-itself');
  });

  it('the Bodywise glycolic stick on underarms is Pick one here', () => {
    const stick = shelfItemFromCatalog('bw-glycolic-stick', { areas: ['underarm', 'body'], times: 'night' });
    expect(pairRules([stick], 'bw-rollon-4')[0]?.answer).toBe('pick-one');
  });

  it('the Bodywise niacinamide lotion is fine on the body and on underarms', () => {
    const lotion = shelfItemFromCatalog('bw-niacinamide-lotion', { areas: ['underarm'], times: 'morning' });
    expect(pairRules([lotion], 'bw-rollon-4')[0]?.answer).toBe('fine');
  });
});
