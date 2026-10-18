import { describe, expect, it } from 'vitest';
import type { ReactionReport, Severity, Symptom } from '../../contracts';
import { riyaShelf } from '../example';
import { ESCALATION_LINE, suspectItem, triageReaction } from '../triageReaction';
import { item } from './helpers';

const report = (symptoms: Symptom[], severity: Severity, useDay: number, usedSuspect?: ReactionReport['usedSuspect']): ReactionReport => ({
  at: '2026-10-26T20:30:00+05:30',
  symptoms,
  severity,
  useDay,
  usedSuspect,
});
const lotionOnly = [item('l', 'Body lotion', 'Aqua, Niacinamide, Glycerin, Panthenol', ['body'], 'morning')];

describe('reaction desk: the five rules, first match wins', () => {
  it('R1: painful, any symptom -> red, stop, show a doctor', () => {
    const r = triageReaction(report(['stinging'], 'painful', 3), []);
    expect(r).toMatchObject({ ruleId: 'R1', light: 'red', showDoctor: true, showEscalation: false });
    expect(r.action).toEqual(['Stop using it.', 'Show this to a doctor.']);
    expect(r.pauseDays).toBeUndefined();
  });

  it('R2: bumps or rash and bothering -> red', () => {
    const r = triageReaction(report(['bumps-rash', 'redness'], 'bothering', 6), []);
    expect(r).toMatchObject({ ruleId: 'R2', light: 'red', showDoctor: true });
  });

  it('R3: bothering -> amber, pause 3 days, every other night for a week (AC-13-1)', () => {
    const r = triageReaction(report(['stinging'], 'bothering', 9), []);
    expect(r).toMatchObject({ ruleId: 'R3', light: 'amber', pauseDays: 3, showDoctor: false, showEscalation: true });
    expect(r.action).toEqual(['Pause for 3 days.', 'Then use it every other night for a week before going back to every night.']);
  });

  it('R3: darker than before above mild is amber', () => {
    expect(triageReaction(report(['darker'], 'bothering', 20), []).ruleId).toBe('R3');
  });

  it('R2 beats R3 and R1 beats R2 (order)', () => {
    expect(triageReaction(report(['bumps-rash'], 'painful', 4), []).ruleId).toBe('R1');
    expect(triageReaction(report(['bumps-rash'], 'mild', 4), []).ruleId).toBe('R4');
  });

  it('R4: mild on use-day 5 -> green "Common in the first 2 weeks." (AC-13-5)', () => {
    const r = triageReaction(report(['stinging'], 'mild', 5), []);
    expect(r).toMatchObject({ ruleId: 'R4', light: 'green', showEscalation: true, showDoctor: false });
    expect(r.action[0]).toBe('Common in the first 2 weeks.');
  });

  it('R4 holds through use-day 14 and R5 starts at 15', () => {
    expect(triageReaction(report(['flaking'], 'mild', 14), []).ruleId).toBe('R4');
    const r5 = triageReaction(report(['flaking'], 'mild', 15), []);
    expect(r5.ruleId).toBe('R5');
    expect(r5.action).toEqual(['Keep going, skip a day if needed.', 'If it keeps happening, pause for 3 days.']);
  });

  it('a report before Day 0 (use-day 0) is a green R4', () => {
    expect(triageReaction(report(['itching'], 'mild', 0), []).ruleId).toBe('R4');
  });

  it('the escalation line is exported for green and amber screens', () => {
    expect(ESCALATION_LINE).toBe('If it becomes painful, blisters or spreads, stop and show your skin file to a doctor.');
  });
});

describe('reaction desk: likely cause from her shelf (FR-M8-01/02)', () => {
  const shelf = riyaShelf();

  it("Riya's shelf asks about the toner first (AC-12-2)", () => {
    expect(suspectItem(shelf)?.id).toBe('riya-toner');
    const r = triageReaction(report(['stinging'], 'bothering', 9), shelf);
    expect(r.followUp).toEqual({ itemId: 'riya-toner', question: 'Did you use your Glow 7% Glycolic Toner there?' });
    expect(r.likelyCause).toBeUndefined();
  });

  it('yes on the toner: likely cause aha, "Face only from now." (AC-13-2)', () => {
    const r = triageReaction(report(['stinging'], 'bothering', 9, { itemId: 'riya-toner', answer: 'yes' }), shelf);
    expect(r.followUp).toBeUndefined();
    expect(r.likelyCause).toEqual({
      itemId: 'riya-toner',
      product: 'Glow 7% Glycolic Toner',
      ingredientClass: 'aha',
      fix: 'Face only from now.',
    });
  });

  it('yes on an underarm-only product: keep it off your underarms', () => {
    const r = triageReaction(report(['stinging'], 'bothering', 9, { itemId: 'riya-spray', answer: 'yes' }), shelf);
    expect(r.likelyCause?.ingredientClass).toBe('drying-alcohol');
    expect(r.likelyCause?.fix).toBe('Keep it off your underarms while you use the roll-on.');
  });

  it('no on the follow-up: no likely cause and no repeat question', () => {
    const r = triageReaction(report(['stinging'], 'bothering', 9, { itemId: 'riya-toner', answer: 'no' }), shelf);
    expect(r.followUp).toBeUndefined();
    expect(r.likelyCause).toBeUndefined();
  });

  it('a shelf with only the niacinamide lotion asks nothing (AC-12-3)', () => {
    expect(triageReaction(report(['stinging'], 'bothering', 9), lotionOnly).followUp).toBeUndefined();
    expect(suspectItem(lotionOnly)).toBeUndefined();
  });

  it('a face-only acid is not a suspect (the question is about skin the roll-on touches)', () => {
    const faceOnly = [item('t', 'Glow toner', 'Aqua, Glycolic Acid, Witch Hazel, Glycerin', ['face'])];
    expect(suspectItem(faceOnly)).toBeUndefined();
  });

  it('the highest-priority clash is asked about first, ahead of an earlier fragrance-only product', () => {
    const fragrance = item('f', 'Rose mist', 'Aqua, Glycerin, Rose Water, Parfum', ['underarm']);
    const cream = item('c', 'Silk Hair Removal Cream', 'Aqua, Potassium Thioglycolate, Calcium Hydroxide, Parfum', ['underarm']);
    expect(suspectItem([fragrance, cream])?.id).toBe('c');
  });

  it('red also carries the follow-up when unanswered, but no pause days', () => {
    const r = triageReaction(report(['stinging'], 'painful', 9), shelf);
    expect(r.followUp?.itemId).toBe('riya-toner');
    expect(r.pauseDays).toBeUndefined();
  });
});
