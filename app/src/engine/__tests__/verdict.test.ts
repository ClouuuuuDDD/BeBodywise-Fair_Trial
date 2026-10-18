import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { pauseEntries, trialClock } from '../trialClock';
import { stepUpTarget, verdict } from '../verdict';
import { DAY0, change, pickOf, react, trialAt, verdictInput } from './helpers';

describe('verdict: measured path (kill test passed)', () => {
  it('V5 -> Working: lighter beyond the band and she picked today (AC-17-1)', () => {
    const v = verdict(verdictInput());
    expect(v).toMatchObject({ outcome: 'working', rule: 'V5', measured: true, blindPickLed: false, withoutPhotos: false });
    expect(v.reasons).toEqual([
      '56 days of use, enough to judge fairly.',
      'Your underarm moved closer to your inner-arm shade, more than normal photo difference.',
      "Your blind pick agrees: you chose today's photo.",
    ]);
    expect(v.nextStep).toBe('Keep going. Check again in 8 weeks.');
    expect(v.stepUp).toBeUndefined();
  });

  it('V5 also holds when her eye saw no difference but the measurement did', () => {
    const v = verdict(verdictInput({ blindPick: pickOf('same') }));
    expect(v.rule).toBe('V5');
    expect(v.reasons[2]).toBe('Your blind pick saw no clear difference, and the measurement did.');
  });

  it('V6 -> See a doctor: darker beyond the band', () => {
    const v = verdict(verdictInput({ change: change(-6), blindPick: pickOf('same') }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V6', measured: true });
    expect(v.nextStep).toBe('Open my skin file and talk to a Be Bodywise doctor.');
  });

  it('V7 -> Not for you: within the band and she saw no difference (AC-18-1)', () => {
    const v = verdict(verdictInput({ change: change(1), blindPick: pickOf('same') }));
    expect(v).toMatchObject({ outcome: 'not-for-you', rule: 'V7', measured: true });
    expect(v.reasons).toContain('No change beyond normal photo difference.');
    expect(v.reasons).toContain('Your blind pick agrees: they looked the same.');
    expect(v.nextStep).toBe('You gave it a fair trial. You can stop here.');
    expect(v.stepUp).toBe('bw-rollon-6');
  });

  it('V7 with the hormone note is See a doctor by V1, never Not for you (AC-18-2)', () => {
    const v = verdict(verdictInput({ change: change(1), blindPick: pickOf('same'), hormonePattern: true }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V1' });
    expect(v.reasons[0]).toContain('neck and periods');
  });

  it('G4: across seeded V7 cases (bands and values inside it) the outcome is Not for you every time', () => {
    for (const band of [2, 3, 5, 8]) {
      for (const v of [-band, -band / 2, 0, band / 2, band]) {
        const out = verdict(verdictInput({ change: change(v, band), blindPick: pickOf('same') }));
        expect(out.outcome).toBe('not-for-you');
        expect(out.rule).toBe('V7');
      }
    }
  });

  it('the band edge is inside the band; just past it is not', () => {
    expect(verdict(verdictInput({ change: change(4), blindPick: pickOf('same') })).rule).toBe('V7');
    expect(verdict(verdictInput({ change: change(4.01), blindPick: pickOf('same') })).rule).toBe('V5');
    expect(verdict(verdictInput({ change: change(-4), blindPick: pickOf('same') })).rule).toBe('V7');
    expect(verdict(verdictInput({ change: change(-4.01), blindPick: pickOf('same') })).rule).toBe('V6');
  });

  it('V8 -> Not yet, recheck in 28 days: measurement says lighter but her eye says Day 0 is lighter', () => {
    const v = verdict(verdictInput({ blindPick: pickOf('day0-lighter') }));
    expect(v).toMatchObject({ outcome: 'not-yet', rule: 'V8', newDate: addDays(DAY0, 56 + 28) });
    expect(v.nextStep).toBe('Check again on 9 January.');
  });

  it('V8 never carries a step-up: Not yet is not the slow half', () => {
    const v = verdict(verdictInput({ change: change(2), blindPick: pickOf('now-lighter'), reactions: [react('green')] }));
    expect(v).toMatchObject({ outcome: 'not-yet', rule: 'V8' });
    expect(v.stepUp).toBeUndefined();
  });

  it('step-up never rides on Working', () => {
    expect(verdict(verdictInput()).stepUp).toBeUndefined();
    expect(stepUpTarget('bw-rollon-4', [])).toBe('bw-rollon-6');
    expect(stepUpTarget('bw-rollon-6', [])).toBe('bw-kit-6');
    expect(stepUpTarget('bw-kit-4', [])).toBeUndefined();
  });

  it('X1-03 measured path: calm-slow on the 4% -> Not for you, offer the 6%', () => {
    const v = verdict(verdictInput({ change: change(1), blindPick: pickOf('same') }));
    expect(v).toMatchObject({ outcome: 'not-for-you', rule: 'V7', stepUp: 'bw-rollon-6' });
  });

  it('X1-03 calm-slow on the 6% -> Not for you, offer the Advanced kit', () => {
    const v = verdict(verdictInput({ change: change(1), blindPick: pickOf('same'), trial: trialAt(56, 'bw-rollon-6') }));
    expect(v).toMatchObject({ outcome: 'not-for-you', stepUp: 'bw-kit-6' });
  });

  it('X1-03 kill-test-off path K: calm-slow offers the step-up too', () => {
    const base = { killTestPassed: false, change: change(1), blindPick: pickOf('same') } as const;
    expect(verdict(verdictInput(base))).toMatchObject({ outcome: 'not-for-you', rule: 'K', stepUp: 'bw-rollon-6' });
    expect(verdict(verdictInput({ ...base, trial: trialAt(56, 'bw-rollon-6') })).stepUp).toBe('bw-kit-6');
  });

  it('X1-03 no offer after an amber reaction, a sting on the trial product, or on a kit', () => {
    for (const killTestPassed of [true, false]) {
      const base = { killTestPassed, change: change(1), blindPick: pickOf('same') } as const;
      const amber = verdict(verdictInput({ ...base, reactions: [react('amber')] }));
      expect(amber.outcome).toBe('not-for-you');
      expect(amber.stepUp).toBeUndefined();
      expect(verdict(verdictInput({ ...base, trialProductStung: true })).stepUp).toBeUndefined();
      expect(verdict(verdictInput({ ...base, trial: trialAt(56, 'bw-kit-4') })).stepUp).toBeUndefined();
      expect(verdict(verdictInput({ ...base, trial: trialAt(56, 'bw-kit-6') })).stepUp).toBeUndefined();
    }
  });

  it('X1-03 hormone note -> See a doctor with no offer', () => {
    for (const killTestPassed of [true, false]) {
      const v = verdict(verdictInput({ killTestPassed, change: change(1), blindPick: pickOf('same'), hormonePattern: true }));
      expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V1' });
      expect(v.stepUp).toBeUndefined();
    }
  });

  it('a skipped blind pick leaves one read: Not yet, except darker beyond the band', () => {
    expect(verdict(verdictInput({ blindPick: null })).outcome).toBe('not-yet');
    expect(verdict(verdictInput({ change: change(-9), blindPick: null })).rule).toBe('V6');
  });
});

describe('verdict: earlier rules', () => {
  it('V1: a red reaction logged -> See a doctor, even before 56 use-days', () => {
    const v = verdict(verdictInput({ reactions: [react('green'), react('red')], trial: trialAt(12) }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V1', measured: false });
    expect(v.reasons[0]).toContain('reaction');
  });

  it('V2: use-days under 56 -> Not yet, new date = today + remaining (AC-V-NY-1: 30 use-days -> +26)', () => {
    const today = addDays(DAY0, 30);
    const v = verdict(verdictInput({ trial: trialAt(30), today }));
    expect(v).toMatchObject({ outcome: 'not-yet', rule: 'V2', newDate: addDays(today, 26) });
    expect(v.reasons).toEqual(['Not enough use-days yet.', '30 of 56 use-days so far.']);
  });

  it('V2: the example Not yet ending re-dates to 3 January', () => {
    const skips = Array.from({ length: 19 }, (_, i) => ({ date: addDays(DAY0, 30 + i), status: 'skipped' as const, source: 'tap' as const }));
    const log = [...pauseEntries(addDays(DAY0, 9)), ...skips];
    const today = addDays(DAY0, 59);
    const trial = trialClock({ productId: 'bw-rollon-4', startDate: DAY0, dayLog: log, today });
    expect(trial.useDaysSoFar).toBe(37);
    const v = verdict(verdictInput({ trial, today, change: null, blindPick: null }));
    expect(v.rule).toBe('V2');
    expect(v.newDate).toBe('2027-01-03');
    expect(v.nextStep).toBe('Keep going. New date: 3 January.');
    expect(trial.judgeByDate).toBe('2027-01-03');
  });

  it('V1 is checked before V2 and V2 before V3', () => {
    const short = trialAt(10);
    expect(verdict(verdictInput({ trial: short, change: null, reactions: [react('red')] })).rule).toBe('V1');
    expect(verdict(verdictInput({ trial: short, change: null })).rule).toBe('V2');
  });

  it('V4: not comparable -> Can\'t call it, retake in daylight (AC-V-CC-1)', () => {
    const v = verdict(verdictInput({ change: change(10, 4, false) }));
    expect(v).toMatchObject({ outcome: 'cant-call', rule: 'V4', measured: false });
    expect(v.nextStep).toBe('Retake in daylight near a window.');
  });

  it('V4 holds when the kill test is off too', () => {
    expect(verdict(verdictInput({ change: change(10, 4, false), killTestPassed: false })).rule).toBe('V4');
  });
});

describe('verdict: no Day 0 photos (V3, AC-V-4)', () => {
  const noPhotos = { change: null, blindPick: null } as const;

  it('lighter by a step -> Working by your eye', () => {
    const v = verdict(verdictInput({ ...noPhotos, shadeDay0: 'moderate', shadeNow: 'mild' }));
    expect(v).toMatchObject({ outcome: 'working', rule: 'V3', withoutPhotos: true, measured: false });
    expect(v.reasons[0]).toBe('No photos, so nothing was measured. This is your own eye.');
  });

  it('same -> Not for you by your eye', () => {
    const v = verdict(verdictInput({ ...noPhotos, shadeDay0: 'moderate', shadeNow: 'moderate' }));
    expect(v).toMatchObject({ outcome: 'not-for-you', rule: 'V3', withoutPhotos: true });
  });

  it('same with the hormone note -> See a doctor, as V1', () => {
    const v = verdict(verdictInput({ ...noPhotos, shadeDay0: 'moderate', shadeNow: 'moderate', hormonePattern: true }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V1', withoutPhotos: true });
  });

  it('darker -> See a doctor', () => {
    const v = verdict(verdictInput({ ...noPhotos, shadeDay0: 'mild', shadeNow: 'moderate' }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V3', withoutPhotos: true });
  });

  it('missing shade answers cannot be called', () => {
    const v = verdict(verdictInput({ ...noPhotos, shadeDay0: undefined, shadeNow: undefined }));
    expect(v.outcome).toBe('cant-call');
    expect(v.needsShadeAnswer).toBe(true);
  });
});

describe('verdict: kill test off, the blind pick leads (rule K)', () => {
  const off = { killTestPassed: false };

  it('today lighter -> Working, measurement supporting only', () => {
    const v = verdict(verdictInput(off));
    expect(v).toMatchObject({ outcome: 'working', rule: 'K', blindPickLed: true, measured: false });
    expect(v.reasons[2]).toContain('supporting number');
  });

  it('same -> Not for you even when the measurement says lighter', () => {
    const v = verdict(verdictInput({ ...off, blindPick: pickOf('same') }));
    expect(v).toMatchObject({ outcome: 'not-for-you', rule: 'K', blindPickLed: true });
  });

  it('same with the hormone note -> See a doctor', () => {
    const v = verdict(verdictInput({ ...off, blindPick: pickOf('same'), hormonePattern: true }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'V1' });
  });

  it('Day 0 lighter -> See a doctor', () => {
    const v = verdict(verdictInput({ ...off, blindPick: pickOf('day0-lighter') }));
    expect(v).toMatchObject({ outcome: 'see-doctor', rule: 'K', blindPickLed: true });
  });

  it('a skipped pick leaves nothing to lead: Not yet with a recheck date', () => {
    const v = verdict(verdictInput({ ...off, blindPick: null }));
    expect(v).toMatchObject({ outcome: 'not-yet', rule: 'K', newDate: addDays(DAY0, 56 + 28) });
  });

  it('the measurement is ignored for the outcome: darker beyond the band with a today pick is still Working', () => {
    expect(verdict(verdictInput({ ...off, change: change(-9) })).outcome).toBe('working');
  });
});

describe('verdict: reasons and use-days wording', () => {
  it('notes days that were assumed used (RC-14)', () => {
    const v = verdict(verdictInput({ trial: trialAt(56) }));
    expect(v.reasons[0]).toBe('56 days of use, enough to judge fairly.');
    const assumed = trialClock({ productId: 'bw-rollon-4', startDate: DAY0, dayLog: [], today: addDays(DAY0, 56) });
    expect(verdict(verdictInput({ trial: assumed })).reasons[0]).toBe('56 days of use, 56 of them not logged and counted as used.');
  });

  it('no verdict suggests a purchase or a product (FR-M10-03)', () => {
    const all = [
      verdict(verdictInput()),
      verdict(verdictInput({ change: change(1), blindPick: pickOf('same') })),
      verdict(verdictInput({ change: change(10, 4, false) })),
      verdict(verdictInput({ blindPick: pickOf('day0-lighter') })),
    ];
    for (const v of all) expect(`${v.reasons.join(' ')} ${v.nextStep}`).not.toMatch(/buy|cart|discount|Rs \d/i);
  });
});
