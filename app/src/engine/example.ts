/**
 * Riya's seeded example trial for every jump key (PRD AC-22-5). Built by running the real engine on her
 * worked example (solution/shelf-check-spec.md), so the example can never drift from the rules. The photo
 * numbers are ILLUSTRATIVE seed values for a staged example, not measurements of anyone. No clock reads:
 * "today" is fixed per stop. Third-party products are fictional (Glow toner, Fresh Bloom spray, Silk cream).
 */
import type {
  BlindPick,
  DayLogEntry,
  ExampleState,
  ExampleStop,
  FitAnswers,
  ISODate,
  PhotoChange,
  Plan,
  ReactionRecord,
  ReactionReport,
  ShelfItem,
  Verdict,
} from '../contracts';
import { DEFAULT_ANCHOR_PRODUCT, KILL_TEST_PASSED } from './config';
import { addDays } from './dates';
import { fit } from './fit';
import { pairRules } from './pairRules';
import { pickProduct } from './pickProduct';
import { makeShelfItem, shelfItemFromCatalog } from './shelf';
import { rulesVersion } from './rulesVersion';
import { startPlan } from './startPlan';
import { triageReaction } from './triageReaction';
import { pauseEntries, trialClock } from './trialClock';
import { verdict } from './verdict';

/** Every jump key, in the order the example page lists them. */
export const EXAMPLE_STOPS: readonly ExampleStop[] = [
  'check',
  'day-0',
  'day-9',
  'day-23',
  'halfway',
  'day-40',
  'day-56-working',
  'day-56-not-for-you',
  'not-yet',
  'cant-call',
  'see-doctor',
  'keep-going',
  'insights',
];

/** Fixed dates of the example (PRD "Riya seed": check 14 Oct, Day 0 17 Oct, judge-by 12 Dec before the pause). */
export const EXAMPLE_DATES = {
  checkedOn: '2026-10-14',
  day0: '2026-10-17',
} as const;

/** Calendar days after Day 0 for each stop. Use-days differ because of the 3 paused days after Day 9. */
const CALENDAR_DAY = {
  amber: 9,
  day23: 26,
  halfway: 31,
  day40: 43,
  verdict: 59,
  keepGoing: 60,
  red: 12,
} as const;

/** Not yet ending: 19 skipped days (16 Nov to 4 Dec) push the date to 3 January (F-133). */
const NOT_YET_SKIPS = { firstOffset: 30, count: 19 } as const;

/** Riya's answers: clearly darker, a year or more, razor, neck no, periods regular. */
export const RIYA_FIT: FitAnswers = {
  shade: 'moderate',
  duration: 'year-plus',
  hairRemoval: 'razor',
  darkNeck: 'no',
  regularPeriods: 'yes',
};

/** Riya's four shelf products, as a label read would return them (fictional brands). */
export function riyaShelf(): ShelfItem[] {
  return [
    makeShelfItem({
      id: 'riya-toner',
      product: 'Glow 7% Glycolic Toner',
      source: 'label',
      inci: 'Aqua, Glycolic Acid, Witch Hazel, Aloe, Glycerin, Parfum',
      areas: ['face', 'underarm'],
      times: 'night',
      mascot: 'toner',
    }),
    makeShelfItem({
      id: 'riya-spray',
      product: 'Fresh Bloom Deo Spray',
      source: 'label',
      inci: 'Alcohol Denat., Butane, Aluminium Chlorohydrate, Parfum',
      areas: ['underarm'],
      times: 'morning',
      stung: true,
      antiperspirantFor: 'smell',
      mascot: 'spray-can',
    }),
    makeShelfItem({
      id: 'riya-cream',
      product: 'Silk Hair Removal Cream',
      source: 'label',
      inci: 'Aqua, Potassium Thioglycolate, Calcium Hydroxide, Parfum',
      areas: ['underarm'],
      times: 'now-and-then',
      mascot: 'hair-removal',
    }),
    shelfItemFromCatalog('bw-niacinamide-lotion', { id: 'riya-lotion', areas: ['body'], times: 'morning' }),
  ];
}

const eveningOf = (day: ISODate) => `${day}T20:30:00+05:30`;

function amberReaction(shelf: ShelfItem[]): ReactionRecord {
  const report: ReactionReport = {
    at: eveningOf(addDays(EXAMPLE_DATES.day0, CALENDAR_DAY.amber)),
    symptoms: ['stinging'],
    severity: 'bothering',
    useDay: CALENDAR_DAY.amber,
    usedSuspect: { itemId: 'riya-toner', answer: 'yes' },
  };
  return { report, result: triageReaction(report, shelf) };
}

function redReaction(shelf: ShelfItem[]): ReactionRecord {
  const report: ReactionReport = {
    at: eveningOf(addDays(EXAMPLE_DATES.day0, CALENDAR_DAY.red)),
    symptoms: ['bumps-rash', 'redness'],
    severity: 'painful',
    useDay: CALENDAR_DAY.red,
  };
  return { report, result: triageReaction(report, shelf) };
}

/** ILLUSTRATIVE seed values for staged photos. Positive change = underarm moved toward her inner arm. */
function seedChange(kind: 'working' | 'within' | 'not-comparable'): PhotoChange {
  const band = { itaDeg: 4, source: 'day0-pair' as const, samples: 3 };
  if (kind === 'working') {
    return { gapDay0: 24, gapNow: 14, change: 10, band, beyondBand: true, darkerBeyondBand: false, comparable: true, bucket: 'beyond-band' };
  }
  if (kind === 'within') {
    return { gapDay0: 22, gapNow: 21, change: 1, band, beyondBand: false, darkerBeyondBand: false, comparable: true, bucket: 'within-band' };
  }
  return { gapDay0: 24, gapNow: 9, change: 15, band, beyondBand: true, darkerBeyondBand: false, comparable: false, bucket: 'not-comparable' };
}

function seedPick(choice: 'now-lighter' | 'same'): BlindPick {
  const at = `${addDays(EXAMPLE_DATES.day0, CALENDAR_DAY.verdict)}T09:10:00+05:30`;
  return choice === 'now-lighter'
    ? { shownAsA: 'now', choice: 'A', says: 'now-lighter', at }
    : { shownAsA: 'day0', choice: 'same', says: 'same', at };
}

interface Stage {
  /** Calendar days after Day 0; omit for the pre-trial stop. */
  offset?: number;
  dayLog?: DayLogEntry[];
  reactions?: ReactionRecord[];
  photoIds?: string[];
  blindPick?: BlindPick;
  change?: PhotoChange | null;
  /** Whether to compute the verdict at this stop. */
  verdict?: boolean;
  shadeNow?: FitAnswers['shade'];
}

const DAY0_PHOTOS = ['riya-day0-underarm', 'riya-day0-inner-arm'];
const VERDICT_PHOTOS = ['riya-verdict-underarm', 'riya-verdict-inner-arm'];

function skippedDays(): DayLogEntry[] {
  return Array.from({ length: NOT_YET_SKIPS.count }, (_, i) => ({
    date: addDays(EXAMPLE_DATES.day0, NOT_YET_SKIPS.firstOffset + i),
    status: 'skipped' as const,
    source: 'tap' as const,
  }));
}

function build(stop: ExampleStop, stage: Stage): ExampleState {
  const shelf = riyaShelf();
  const fitResult = fit(RIYA_FIT);
  const shelfAnswers = pairRules(shelf, DEFAULT_ANCHOR_PRODUCT);
  const pick = pickProduct({ fit: RIYA_FIT, shelf, shelfAnswers });
  const started = stage.offset !== undefined;
  const today = addDays(started ? EXAMPLE_DATES.day0 : EXAMPLE_DATES.checkedOn, stage.offset ?? 0);
  const dayLog = stage.dayLog ?? [];
  const reactions = stage.reactions ?? [];
  const productId = pick.pick ?? DEFAULT_ANCHOR_PRODUCT;

  const plan: Plan = {
    planCode: 'FT-4K7Q',
    trialId: '00000000-0000-4000-8000-0000000e0001',
    mode: 'example',
    checkedOn: EXAMPLE_DATES.checkedOn,
    channel: 'example',
    fit: RIYA_FIT,
    fitResult,
    shelf,
    shelfAnswers,
    pick,
    dayLog,
    reactions,
    photoIds: stage.photoIds ?? [],
    photosSkipped: false,
    rulesVersion: rulesVersion(),
  };
  if (started) {
    plan.trialProduct = productId;
    plan.startPlan = startPlan(pick, shelf, shelfAnswers, RIYA_FIT, productId);
    plan.day0 = EXAMPLE_DATES.day0;
  }
  if (stage.blindPick) plan.blindPick = stage.blindPick;
  if (stage.verdict && started) {
    const trial = trialClock({ productId, startDate: EXAMPLE_DATES.day0, dayLog, today });
    const v: Verdict = verdict({
      trial,
      reactions,
      change: stage.change ?? null,
      blindPick: stage.blindPick ?? null,
      shadeDay0: RIYA_FIT.shade,
      shadeNow: stage.shadeNow,
      hormonePattern: fitResult.hormoneNote,
      killTestPassed: KILL_TEST_PASSED,
      today,
    });
    plan.verdict = v;
  }
  return { isExample: true, persona: 'Riya', plan, today, stop };
}

/** Riya's seeded state at a jump key. `today` is what the engine takes as "today"; nothing reads the clock. */
export function exampleState(stop: ExampleStop): ExampleState {
  const shelf = riyaShelf();
  const amber = amberReaction(shelf);
  const pauses = pauseEntries(addDays(EXAMPLE_DATES.day0, CALENDAR_DAY.amber));
  const afterAmber = { dayLog: pauses, reactions: [amber], photoIds: DAY0_PHOTOS };
  const verdictDay = { ...afterAmber, offset: CALENDAR_DAY.verdict, photoIds: [...DAY0_PHOTOS, ...VERDICT_PHOTOS], verdict: true };

  switch (stop) {
    case 'check':
      return build(stop, {});
    case 'day-0':
      return build(stop, { offset: 0, photoIds: DAY0_PHOTOS });
    case 'day-9':
      return build(stop, { ...afterAmber, offset: CALENDAR_DAY.amber });
    case 'day-23':
      return build(stop, { ...afterAmber, offset: CALENDAR_DAY.day23 });
    case 'halfway':
      return build(stop, { ...afterAmber, offset: CALENDAR_DAY.halfway, photoIds: [...DAY0_PHOTOS, 'riya-halfway-underarm', 'riya-halfway-inner-arm'] });
    case 'day-40':
      return build(stop, { ...afterAmber, offset: CALENDAR_DAY.day40 });
    case 'day-56-working':
      return build(stop, { ...verdictDay, change: seedChange('working'), blindPick: seedPick('now-lighter') });
    case 'day-56-not-for-you':
      return build(stop, { ...verdictDay, change: seedChange('within'), blindPick: seedPick('same') });
    case 'not-yet':
      return build(stop, { ...afterAmber, dayLog: [...pauses, ...skippedDays()], offset: CALENDAR_DAY.verdict, verdict: true });
    case 'cant-call':
      return build(stop, { ...verdictDay, change: seedChange('not-comparable'), blindPick: seedPick('same') });
    case 'see-doctor': {
      const red = redReaction(shelf);
      return build(stop, {
        offset: CALENDAR_DAY.red,
        dayLog: pauseEntries(addDays(EXAMPLE_DATES.day0, CALENDAR_DAY.red), 'reaction-red', 1),
        reactions: [red],
        photoIds: DAY0_PHOTOS,
        verdict: true,
      });
    }
    case 'keep-going':
    case 'insights': {
      // The Working verdict was given on verdict day; Keep Going starts the day after.
      const state = build(stop, { ...verdictDay, offset: CALENDAR_DAY.keepGoing, change: seedChange('working'), blindPick: seedPick('now-lighter') });
      const given = exampleState('day-56-working').plan.verdict;
      if (given) state.plan.verdict = given;
      return state;
    }
  }
}
