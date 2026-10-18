import { describe, expect, it } from 'vitest';
import type { DayLogEntry } from '../../contracts';
import { addDays, diffDays, formatDayMonth, isoWeek } from '../dates';
import { costIsEstimate, nextCheckDate, pauseEntries, trialClock, weeksInBucket } from '../trialClock';
import { DAY0 } from './helpers';

const clock = (today: string, dayLog: DayLogEntry[] = [], extra: { productId?: 'bw-rollon-6'; eventDate?: string } = {}) =>
  trialClock({ productId: extra.productId ?? 'bw-rollon-4', startDate: DAY0, dayLog, today, eventDate: extra.eventDate });

const paused = (date: string): DayLogEntry => ({ date, status: 'paused', source: 'tap' });
const skipped = (date: string): DayLogEntry => ({ date, status: 'skipped', source: 'tap' });
const used = (date: string): DayLogEntry => ({ date, status: 'used', source: 'tap' });

describe('trial clock: date, bottles and cost (FR-M7)', () => {
  it('Day 0 on 17 Oct gives a judge-by date of 12 Dec, 2 bottles, Rs 658', () => {
    const s = clock(DAY0);
    expect(s.judgeByDate).toBe('2026-12-12');
    expect(s.targetUseDays).toBe(56);
    expect(s.bottles).toBe(2);
    expect(s.costInr).toBe(658);
    expect(s.costIsEstimate).toBe(false);
    expect(s.useDaysSoFar).toBe(0);
    expect(s.calendarDay).toBe(0);
    expect(s.daysToVerdict).toBe(56);
  });

  it('6% roll-on costs Rs 798 to know', () => {
    expect(clock(DAY0, [], { productId: 'bw-rollon-6' }).costInr).toBe(798);
  });

  it('kits and the cream are flagged as an estimate (PRD GAP-5)', () => {
    expect(costIsEstimate('bw-kit-4')).toBe(true);
    expect(costIsEstimate('bw-repair-cream')).toBe(true);
    expect(costIsEstimate('bw-rollon-4')).toBe(false);
  });
});

describe('trial clock: use-days, assumed days, pauses', () => {
  it('unlogged days count as used and are reported as assumed', () => {
    const s = clock(addDays(DAY0, 10));
    expect(s.useDaysSoFar).toBe(10);
    expect(s.assumedDays).toBe(10);
    expect(s.assumingDailyUse).toBe(true);
    expect(s.judgeByDate).toBe('2026-12-12');
  });

  it('days logged used are not assumed', () => {
    const log = [used(addDays(DAY0, 1)), used(addDays(DAY0, 2))];
    const s = clock(addDays(DAY0, 2), log);
    expect(s.useDaysSoFar).toBe(2);
    expect(s.assumedDays).toBe(0);
    expect(s.assumingDailyUse).toBe(false);
  });

  it('paused days are not use-days and push the date back: 3 paused days -> 15 Dec', () => {
    const log = pauseEntries(addDays(DAY0, 9));
    const s = clock(addDays(DAY0, 26), log);
    expect(s.pausedDays).toBe(3);
    expect(s.judgeByDate).toBe('2026-12-15');
    expect(s.useDaysSoFar).toBe(23);
    expect(s.calendarDay).toBe(26);
  });

  it('skipped days push the date back the same way', () => {
    const log = [skipped(addDays(DAY0, 3)), skipped(addDays(DAY0, 4))];
    const s = clock(addDays(DAY0, 6), log);
    expect(s.skippedDays).toBe(2);
    expect(s.useDaysSoFar).toBe(4);
    expect(s.judgeByDate).toBe('2026-12-14');
  });

  it('a pause logged ahead of today moves the date straight away, and use-days wait for those days to pass', () => {
    const log = pauseEntries(addDays(DAY0, 9));
    const s = clock(addDays(DAY0, 9), log);
    expect(s.useDaysSoFar).toBe(9);
    expect(s.judgeByDate).toBe('2026-12-15');
  });

  it('the last entry for a date wins (clearing a pause by logging used)', () => {
    const d = addDays(DAY0, 5);
    const s = clock(addDays(DAY0, 5), [paused(d), used(d)]);
    expect(s.pausedDays).toBe(0);
    expect(s.useDaysSoFar).toBe(5);
    expect(s.judgeByDate).toBe('2026-12-12');
  });

  it('entries on or before Day 0 are ignored', () => {
    const s = clock(addDays(DAY0, 2), [paused(DAY0), paused(addDays(DAY0, -3))]);
    expect(s.pausedDays).toBe(0);
    expect(s.useDaysSoFar).toBe(2);
  });

  it('today before Day 0 is a quiet zero state', () => {
    const s = clock(addDays(DAY0, -2));
    expect(s.calendarDay).toBe(0);
    expect(s.useDaysSoFar).toBe(0);
  });

  it('daysToVerdict never goes below 0', () => {
    expect(clock(addDays(DAY0, 70)).daysToVerdict).toBe(0);
  });

  it('use-days reach 56 exactly on the judge-by date, with and without pauses', () => {
    expect(clock('2026-12-12').useDaysSoFar).toBe(56);
    expect(clock('2026-12-12').verdictDue).toBe(true);
    const log = pauseEntries(addDays(DAY0, 9));
    expect(clock('2026-12-14', log).verdictDue).toBe(false);
    expect(clock('2026-12-15', log).verdictDue).toBe(true);
    expect(clock('2026-12-15', log).useDaysSoFar).toBe(56);
  });
});

describe('trial clock: refill, halfway, bottle date, event mode', () => {
  const log = pauseEntries(addDays(DAY0, 9));

  it('refill shows from use-day 40 (16 days to the verdict in the example), not at 39 (AC-14-1, AC-14-5)', () => {
    const at40 = clock(addDays(DAY0, 43), log);
    expect(at40.useDaysSoFar).toBe(40);
    expect(at40.refillDue).toBe(true);
    expect(at40.daysToVerdict).toBe(16);
    const at39 = clock(addDays(DAY0, 42), log);
    expect(at39.useDaysSoFar).toBe(39);
    expect(at39.refillDue).toBe(false);
  });

  it('refill is not due once the verdict is due', () => {
    expect(clock('2026-12-15', log).refillDue).toBe(false);
  });

  it('halfway card from use-day 28 (AC-11-6)', () => {
    expect(clock(addDays(DAY0, 30), log).halfwayDue).toBe(false);
    const s = clock(addDays(DAY0, 31), log);
    expect(s.useDaysSoFar).toBe(28);
    expect(s.halfwayDue).toBe(true);
  });

  it('next bottle after the verdict: use-day 80, 8 Jan 2027 (GAP-2)', () => {
    const s = clock('2026-12-15', log);
    expect(s.bottleRunsOutOn).toBe('2027-01-08');
  });

  it('at use-day 40 the bottle runs out today; a later pause pushes a later bottle date', () => {
    expect(clock(addDays(DAY0, 43), log).bottleRunsOutOn).toBe(addDays(DAY0, 43));
    const future = [...log, paused(addDays(DAY0, 45))];
    expect(clock(addDays(DAY0, 43), future).judgeByDate).toBe('2026-12-16');
    expect(clock(addDays(DAY0, 44), future).bottleRunsOutOn).toBe(addDays(DAY0, 84));
  });

  it('event mode: 20 Nov is about 5 weeks in (AC-10-4)', () => {
    const s = clock(DAY0, [], { eventDate: '2026-11-20' });
    expect(s.weeksByEvent).toBe(5);
    expect(s.eventDate).toBe('2026-11-20');
    expect(weeksInBucket(3)).toBe('lt4');
    expect(weeksInBucket(5)).toBe('4to6');
    expect(weeksInBucket(7)).toBe('6to8');
  });

  it('Keep Going next check is 8 weeks after the verdict: 15 Dec -> 9 Feb', () => {
    expect(nextCheckDate('2026-12-15')).toBe('2027-02-09');
  });

  it('pauseEntries logs 3 paused days after the report day', () => {
    expect(pauseEntries('2026-10-26')).toEqual([
      { date: '2026-10-27', status: 'paused', source: 'reaction-amber' },
      { date: '2026-10-28', status: 'paused', source: 'reaction-amber' },
      { date: '2026-10-29', status: 'paused', source: 'reaction-amber' },
    ]);
  });
});

describe('date helpers', () => {
  it('adds and differences days across months and years', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(diffDays('2027-02-09', '2026-12-15')).toBe(56);
    expect(formatDayMonth('2027-01-03')).toBe('3 January');
  });

  it('ISO week for the share payload', () => {
    expect(isoWeek('2026-12-15')).toBe('2026-W51');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(() => addDays('15/12/2026', 1)).toThrow();
  });
});
