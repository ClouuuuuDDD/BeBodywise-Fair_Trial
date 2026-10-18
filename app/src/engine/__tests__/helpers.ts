import type {
  BodyArea,
  BodywiseProductId,
  FitAnswers,
  PhotoChange,
  ReactionRecord,
  ShelfItem,
  TrialState,
  UseTime,
  VerdictInput,
} from '../../contracts';
import { addDays } from '../dates';
import { makeShelfItem } from '../shelf';
import { trialClock } from '../trialClock';

export const DAY0 = '2026-10-17';

export function item(
  id: string,
  product: string,
  inci: string,
  areas: BodyArea[],
  times: UseTime = 'night',
  extra: { stung?: boolean; antiperspirantFor?: ShelfItem['antiperspirantFor'] } = {},
): ShelfItem {
  return makeShelfItem({ id, product, source: 'label', inci, areas, times, ...extra });
}

export const FIT_MODERATE: FitAnswers = {
  shade: 'moderate',
  duration: 'year-plus',
  hairRemoval: 'none',
  darkNeck: 'no',
  regularPeriods: 'yes',
};

/** A trial `days` calendar days after Day 0 with every day logged used. */
export function trialAt(days: number, product: BodywiseProductId = 'bw-rollon-4'): TrialState {
  const dayLog = Array.from({ length: days }, (_, i) => ({
    date: addDays(DAY0, i + 1),
    status: 'used' as const,
    source: 'tap' as const,
  }));
  return trialClock({ productId: product, startDate: DAY0, dayLog, today: addDays(DAY0, days) });
}

export function change(value: number, band = 4, comparable = true): PhotoChange {
  return {
    gapDay0: 20,
    gapNow: 20 - value,
    change: value,
    band: { itaDeg: band, source: 'day0-pair', samples: 3 },
    beyondBand: value > band,
    darkerBeyondBand: value < -band,
    comparable,
    bucket: !comparable ? 'not-comparable' : value > band ? 'beyond-band' : value < -band ? 'darker-beyond-band' : 'within-band',
  };
}

export function react(light: 'green' | 'amber' | 'red'): ReactionRecord {
  return {
    report: { at: '2026-11-01T10:00:00+05:30', symptoms: ['stinging'], severity: 'mild', useDay: 5 },
    result: {
      ruleId: light === 'red' ? 'R1' : light === 'amber' ? 'R3' : 'R4',
      light,
      action: [],
      showDoctor: light === 'red',
      showEscalation: light !== 'red',
    },
  };
}

export function verdictInput(over: Partial<VerdictInput> = {}): VerdictInput {
  return {
    trial: trialAt(56),
    reactions: [],
    change: change(10),
    blindPick: { shownAsA: 'now', choice: 'A', says: 'now-lighter', at: '2026-12-12T09:00:00+05:30' },
    shadeDay0: 'moderate',
    shadeNow: 'mild',
    hormonePattern: false,
    killTestPassed: true,
    today: addDays(DAY0, 56),
    ...over,
  };
}

export function pickOf(says: 'now-lighter' | 'same' | 'day0-lighter'): NonNullable<VerdictInput['blindPick']> {
  return {
    shownAsA: 'now',
    choice: says === 'same' ? 'same' : says === 'now-lighter' ? 'A' : 'B',
    says,
    at: '2026-12-12T09:00:00+05:30',
  };
}
