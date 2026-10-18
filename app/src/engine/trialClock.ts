import type { DayLogEntry, ISODate, TrialClockInput, TrialState } from '../contracts';
import {
  BOTTLE_DAYS,
  DAYS_PER_WEEK,
  EVENT_WEEKS_BUCKET_EDGES,
  HALFWAY_USE_DAY,
  KEEP_GOING_CHECK_WEEKS,
  KIT_IDS,
  PAUSE_DAYS,
  TRIAL_USE_DAYS,
} from './config';
import { addDays, diffDays } from './dates';
import { productPrice } from './products';

/** Last write wins per date; drops entries on or before Day 0 (Day 0 is the baseline day, not a use-day). */
function logByDate(dayLog: DayLogEntry[], startDate: ISODate): Map<ISODate, DayLogEntry> {
  const byDate = new Map<ISODate, DayLogEntry>();
  for (const entry of dayLog) if (diffDays(entry.date, startDate) > 0) byDate.set(entry.date, entry);
  return byDate;
}

const isOff = (e: DayLogEntry | undefined): boolean => e !== undefined && e.status !== 'used';

/** Date when use-days reach `target`, walking forward from today and skipping paused or skipped days already logged. */
function dateUseDaysReach(target: number, useDaysNow: number, today: ISODate, log: Map<ISODate, DayLogEntry>): ISODate {
  let date = today;
  let count = useDaysNow;
  while (count < target) {
    date = addDays(date, 1);
    if (!isOff(log.get(date))) count++;
  }
  return date;
}

/**
 * Trial clock (PRD 8.7). Use-day = a day logged 'used' or not logged at all (assumed used); paused and
 * skipped days are not use-days and push the date back. Day 0 is the baseline day: use-days count the
 * days after it up to and including today. judgeByDate = Day 0 + TRIAL_USE_DAYS + paused + skipped.
 * "Day N of 56" = useDaysSoFar. Bottles = ceil(TRIAL_USE_DAYS / BOTTLE_DAYS) = 2; cost = bottles x
 * list price (Rs 658 for the 4%, Rs 798 for the 6%; kits and the cream are an estimate, PRD GAP-5).
 * Refill due from use-day BOTTLE_DAYS while the verdict is still ahead.
 * Example: Day 0 17 Oct -> 12 Dec; with 3 paused days -> 15 Dec.
 */
export function trialClock(input: TrialClockInput): TrialState {
  const { productId, startDate, today, eventDate } = input;
  const log = logByDate(input.dayLog, startDate);

  const calendarDay = Math.max(0, diffDays(today, startDate));
  let useDays = 0;
  let assumed = 0;
  let paused = 0;
  let skipped = 0;
  for (let offset = 1; offset <= calendarDay; offset++) {
    const entry = log.get(addDays(startDate, offset));
    if (entry === undefined) {
      useDays++;
      assumed++;
    } else if (entry.status === 'used') {
      useDays++;
    }
  }
  // Paused and skipped days push the date back even when they are logged ahead of today (the amber pause).
  for (const entry of log.values()) {
    if (entry.status === 'paused') paused++;
    if (entry.status === 'skipped') skipped++;
  }

  const judgeByDate = addDays(startDate, TRIAL_USE_DAYS + paused + skipped);
  const bottles = Math.ceil(TRIAL_USE_DAYS / BOTTLE_DAYS);
  const verdictDue = useDays >= TRIAL_USE_DAYS;
  const nextBottleUseDay = Math.max(1, Math.ceil(useDays / BOTTLE_DAYS)) * BOTTLE_DAYS;

  const state: TrialState = {
    productId,
    startDate,
    targetUseDays: TRIAL_USE_DAYS,
    useDaysSoFar: useDays,
    assumedDays: assumed,
    assumingDailyUse: assumed > 0,
    pausedDays: paused,
    skippedDays: skipped,
    calendarDay,
    judgeByDate,
    daysToVerdict: Math.max(0, diffDays(judgeByDate, today)),
    bottles,
    costInr: bottles * productPrice(productId),
    costIsEstimate: costIsEstimate(productId),
    bottleRunsOutOn: dateUseDaysReach(nextBottleUseDay, useDays, today, log),
    refillDue: useDays >= BOTTLE_DAYS && !verdictDue,
    halfwayDue: useDays >= HALFWAY_USE_DAY && !verdictDue,
    verdictDue,
  };
  if (eventDate !== undefined) {
    state.eventDate = eventDate;
    state.weeksByEvent = Math.max(0, Math.round(diffDays(eventDate, startDate) / DAYS_PER_WEEK));
  }
  return state;
}

/** True when the cost is an estimate: kits and the cream have no bottle life in the data (PRD GAP-5). */
export function costIsEstimate(productId: TrialClockInput['productId']): boolean {
  return KIT_IDS.some((k) => k === productId) || productId === 'bw-repair-cream';
}

/**
 * Paused entries for a reaction: the PAUSE_DAYS days after `from` (the day she reported, already used).
 * The judge-by date moves back by that many days as soon as they are logged (FR-M8-03).
 */
export function pauseEntries(from: ISODate, source: DayLogEntry['source'] = 'reaction-amber', days: number = PAUSE_DAYS): DayLogEntry[] {
  return Array.from({ length: days }, (_, i) => ({ date: addDays(from, i + 1), status: 'paused' as const, source }));
}

/** `event_mode_used.weeks_in_bucket` for a number of weeks (EVENT_WEEKS_BUCKET_EDGES). */
export function weeksInBucket(weeks: number): 'lt4' | '4to6' | '6to8' {
  if (weeks < EVENT_WEEKS_BUCKET_EDGES[0]) return 'lt4';
  if (weeks < EVENT_WEEKS_BUCKET_EDGES[1]) return '4to6';
  return '6to8';
}

/** Keep Going: next check, KEEP_GOING_CHECK_WEEKS after the verdict date (15 Dec -> 9 Feb). */
export function nextCheckDate(verdictDate: ISODate): ISODate {
  return addDays(verdictDate, KEEP_GOING_CHECK_WEEKS * DAYS_PER_WEEK);
}
