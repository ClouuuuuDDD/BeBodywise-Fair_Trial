import { describe, expect, it } from 'vitest';
import { EXAMPLE_DATES, EXAMPLE_STOPS, exampleState } from '../example';
import { nextCheckDate, trialClock } from '../trialClock';
import type { ExampleStop } from '../../contracts';

const clockOf = (stop: ExampleStop) => {
  const { plan, today } = exampleState(stop);
  return trialClock({ productId: 'bw-rollon-4', startDate: EXAMPLE_DATES.day0, dayLog: plan.dayLog, today });
};

describe("Riya's example: every jump key resolves (AC-22-5)", () => {
  it('has all 13 keys, each a labelled example in example mode', () => {
    expect(EXAMPLE_STOPS).toHaveLength(13);
    for (const stop of EXAMPLE_STOPS) {
      const s = exampleState(stop);
      expect(s.isExample).toBe(true);
      expect(s.persona).toBe('Riya');
      expect(s.stop).toBe(stop);
      expect(s.plan.mode).toBe('example');
      expect(s.plan.channel).toBe('example');
      expect(s.plan.planCode).toMatch(/^FT-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("plan is built by the engine: Riya's four rows, 4% No Fragrance Rs 329", () => {
    const { plan } = exampleState('day-0');
    expect(plan.fitResult.outcome).toBe('good-with-habit');
    expect(plan.shelfAnswers.map((a) => a.answer)).toEqual(['pick-one', 'split-time', 'wait', 'fine']);
    expect(plan.pick).toMatchObject({ pick: 'bw-rollon-4', variant: 'no-fragrance', priceInr: 329, ruleRow: 8 });
    expect(plan.trialProduct).toBe('bw-rollon-4');
    expect(plan.startPlan?.productId).toBe('bw-rollon-4');
    expect(plan.day0).toBe('2026-10-17');
    expect(plan.photoIds).toHaveLength(2);
  });

  it('check: before Day 0, no trial product yet', () => {
    const s = exampleState('check');
    expect(s.today).toBe('2026-10-14');
    expect(s.plan.day0).toBeUndefined();
    expect(s.plan.trialProduct).toBeUndefined();
    expect(s.plan.pick.pick).toBe('bw-rollon-4');
  });

  it('day 0: judge-by 12 Dec', () => {
    expect(clockOf('day-0').judgeByDate).toBe('2026-12-12');
  });

  it('day 9: stinging, bothering, toner yes -> amber, judge-by moves to 15 Dec', () => {
    const { plan } = exampleState('day-9');
    expect(plan.reactions).toHaveLength(1);
    expect(plan.reactions[0]?.result).toMatchObject({ light: 'amber', ruleId: 'R3', pauseDays: 3 });
    expect(plan.reactions[0]?.result.likelyCause).toMatchObject({ product: 'Glow 7% Glycolic Toner', fix: 'Face only from now.' });
    const c = clockOf('day-9');
    expect(c.useDaysSoFar).toBe(9);
    expect(c.judgeByDate).toBe('2026-12-15');
  });

  it('day 23: 23 of 56 use-days, 15 Dec', () => {
    const c = clockOf('day-23');
    expect(c.useDaysSoFar).toBe(23);
    expect(c.judgeByDate).toBe('2026-12-15');
    expect(c.assumingDailyUse).toBe(true);
  });

  it('halfway: use-day 28, halfway card due', () => {
    const c = clockOf('halfway');
    expect(c.useDaysSoFar).toBe(28);
    expect(c.halfwayDue).toBe(true);
  });

  it('day 40: refill due, verdict in 16 days', () => {
    const c = clockOf('day-40');
    expect(c.useDaysSoFar).toBe(40);
    expect(c.refillDue).toBe(true);
    expect(c.daysToVerdict).toBe(16);
  });

  it('day 56 working: V5 or K on 15 Dec with 56 use-days (kill test is off in config, so K)', () => {
    const s = exampleState('day-56-working');
    expect(s.today).toBe('2026-12-15');
    expect(s.plan.verdict).toMatchObject({ outcome: 'working' });
    expect(s.plan.blindPick?.says).toBe('now-lighter');
    expect(clockOf('day-56-working').useDaysSoFar).toBe(56);
  });

  it('day 56 other ending: Not for you, never See a doctor (Riya has no hormone pattern)', () => {
    expect(exampleState('day-56-not-for-you').plan.verdict).toMatchObject({ outcome: 'not-for-you' });
  });

  it('not yet: New date 3 January (F-133)', () => {
    const v = exampleState('not-yet').plan.verdict;
    expect(v).toMatchObject({ outcome: 'not-yet', rule: 'V2', newDate: '2027-01-03' });
  });

  it("can't call it: staged lighting mismatch", () => {
    expect(exampleState('cant-call').plan.verdict).toMatchObject({ outcome: 'cant-call', rule: 'V4' });
  });

  it('see a doctor: a painful reaction -> red, V1', () => {
    const s = exampleState('see-doctor');
    expect(s.plan.reactions[0]?.result).toMatchObject({ light: 'red', showDoctor: true });
    expect(s.plan.verdict).toMatchObject({ outcome: 'see-doctor', rule: 'V1' });
  });

  it('all five verdicts are reachable from the seeds (AC-22-4)', () => {
    const outcomes = new Set(EXAMPLE_STOPS.map((s) => exampleState(s).plan.verdict?.outcome).filter(Boolean));
    expect([...outcomes].sort()).toEqual(['cant-call', 'not-for-you', 'not-yet', 'see-doctor', 'working']);
  });

  it('keep going: next check 9 Feb, next bottle 8 Jan (AC-20-1)', () => {
    const s = exampleState('keep-going');
    expect(s.plan.verdict?.outcome).toBe('working');
    expect(nextCheckDate('2026-12-15')).toBe('2027-02-09');
    expect(clockOf('keep-going').bottleRunsOutOn).toBe('2027-01-08');
    expect(exampleState('insights').plan.verdict?.outcome).toBe('working');
  });

  it('carries no real-person data', () => {
    const text = JSON.stringify(EXAMPLE_STOPS.map((s) => exampleState(s)));
    expect(text).not.toMatch(/@|\+91|\d{10}/);
  });
});
