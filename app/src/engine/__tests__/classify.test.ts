import { describe, expect, it } from 'vitest';
import { activeNote, classesOf, classifyIngredients, normaliseInci, readLabel } from '../classifyIngredients';
import { catalogIngredients } from '../shelf';

const TONER = 'Aqua, Glycolic Acid, Witch Hazel, Aloe, Glycerin, Parfum';
const SPRAY = 'Alcohol Denat., Butane, Aluminium Chlorohydrate, Parfum';
const CREAM = 'Aqua, Potassium Thioglycolate, Calcium Hydroxide, Parfum';

describe('classifyIngredients on the three fictional labels (spec worked example)', () => {
  it('Glow toner: glycolic acid is an AHA, glycerin soothes, parfum is fragrance', () => {
    const list = classifyIngredients(TONER);
    expect(list.map((i) => i.inci)).toEqual(['Aqua', 'Glycolic Acid', 'Witch Hazel', 'Aloe', 'Glycerin', 'Parfum']);
    expect(list[1]?.classes).toEqual(['aha']);
    expect(classesOf(list).sort()).toEqual(['aha', 'fragrance', 'soothing']);
  });

  it('Fresh Bloom spray: alcohol denat. in first place counts as drying alcohol; aluminium is an antiperspirant', () => {
    const list = classifyIngredients(SPRAY);
    expect(list[0]?.classes).toEqual(['drying-alcohol']);
    expect(list[2]?.classes).toEqual(['antiperspirant']);
    expect(classesOf(list).sort()).toEqual(['antiperspirant', 'drying-alcohol', 'fragrance']);
  });

  it('Silk cream: potassium thioglycolate is a hair removal chemical', () => {
    const list = classifyIngredients(CREAM);
    expect(list[1]?.classes).toEqual(['depilatory']);
    expect(classesOf(list).sort()).toEqual(['depilatory', 'fragrance']);
  });
});

describe('classifier details', () => {
  it('ignores case, brackets, percentages and a trailing full stop', () => {
    const list = classifyIngredients('AQUA, glycolic ACID (7%), 2% Salicylic Acid, Butyrospermum Parkii (Shea) Butter.');
    expect(list.map((i) => i.classes)).toEqual([[], ['aha'], ['bha'], []]);
    expect(normaliseInci('Alcohol Denat.')).toBe('alcohol denat');
  });

  it('drying alcohol counts only in the first five positions', () => {
    const early = classifyIngredients('Aqua, Glycerin, Alcohol Denat., Parfum');
    const late = classifyIngredients('Aqua, Glycerin, Panthenol, Allantoin, Urea, Alcohol Denat.');
    expect(early[2]?.classes).toEqual(['drying-alcohol']);
    expect(late[5]?.classes).toEqual([]);
  });

  it('fatty alcohols never count as drying alcohol', () => {
    const list = classifyIngredients('Aqua, Cetostearyl Alcohol, Cetearyl Alcohol & Ceteareth-20, Stearyl Alcohol, Cetyl Alcohol');
    expect(classesOf(list)).toEqual([]);
  });

  it('matches inside "(and)" combinations without splitting the chip', () => {
    const list = classifyIngredients('Aqua (and) Sodium Benzoate (and) Potassium Sorbate, Salicylic Acid (and) Glycerin');
    expect(list).toHaveLength(2);
    expect(list[1]?.classes.sort()).toEqual(['bha', 'soothing']);
  });

  it('does not match derivatives of pure vitamin C or pH adjusters', () => {
    const list = classifyIngredients('Aqua, Sodium Lactate, Citric Acid, 3-O-Ethyl Ascorbic Acid, Ascorbyl Glucoside, L-Ascorbic Acid');
    expect(list.map((i) => i.classes)).toEqual([[], [], [], ['brightener'], [], ['vitamin-c-pure']]);
  });

  it('accepts an array from the label reader', () => {
    expect(classifyIngredients(['Aqua', ' Retinol ', 'Glycerin'])).toHaveLength(3);
  });

  it('classifies the catalog products', () => {
    const roll = classesOf(catalogIngredients('bw-rollon-4'));
    expect(roll).toEqual(expect.arrayContaining(['aha', 'bha', 'brightener', 'fragrance']));
    expect(roll).not.toContain('retinoid');
    expect(classesOf(catalogIngredients('bw-repair-cream'))).toEqual(expect.arrayContaining(['aha', 'retinoid', 'brightener']));
  });

  it('describes an acid in plain words for the confirm screen', () => {
    const list = classifyIngredients(TONER);
    expect(activeNote(list[1]!)).toBe('Glycolic Acid: an exfoliating acid, like the roll-on');
    expect(activeNote(list[4]!)).toBeNull();
  });
});

describe('retake rule (spec "Reading labels")', () => {
  it('asks for a retake with fewer than 4 ingredients', () => {
    const r = readLabel('Aqua, Glycolic Acid, Parfum');
    expect(r.needsRetake).toBe(true);
    expect(r.retakeReason).toBe('too-few');
    expect(r.count).toBe(3);
  });

  it('asks for a retake when there are no commas', () => {
    const r = readLabel('Aqua Glycolic Acid Witch Hazel Aloe Glycerin Parfum');
    expect(r.needsRetake).toBe(true);
    expect(r.retakeReason).toBe('no-commas');
  });

  it('accepts exactly 4 ingredients and an "Ingredients:" prefix', () => {
    expect(readLabel(CREAM).needsRetake).toBe(false);
    expect(readLabel(SPRAY).needsRetake).toBe(false);
    expect(readLabel('Ingredients: ' + TONER).count).toBe(6);
  });

  it('retakes an empty read', () => {
    expect(readLabel('').needsRetake).toBe(true);
    expect(readLabel([]).needsRetake).toBe(true);
  });
});
