/**
 * Example mode (E5): Riya's seeded trial, loaded per jump key from the engine, labelled "Example".
 * Lives in its own object store and in session storage; it never reads or writes her real plan.
 */
import { useSyncExternalStore } from 'react';
import type { DayLogEntry, ExampleState, ExampleStop, PhotoChange } from '../contracts';
import { EXAMPLE_DATES, RIYA_FIT, addDays, diffDays, exampleState, trialClock, verdict } from '../engine';
import { KILL_TEST_PASSED } from '../engine/config';
import { getStore, setVaultMode, track } from './vault';

const SESSION_KEY = 'ft-example-state';

function readSession(): ExampleState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ExampleState) : null;
  } catch {
    return null;
  }
}

function writeSession(state: ExampleState | null): void {
  try {
    if (state) sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private window: the example still works for this page load */
  }
}

// A fresh load of the welcome or door page is a new visit, not a return to the example.
if (typeof window !== 'undefined' && ['/', '/door'].includes(window.location.pathname)) writeSession(null);
let current: ExampleState | null = readSession();
if (current) setVaultMode('example');
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function persist(): void {
  writeSession(current);
  const state = current;
  void getStore()
    .then((s) => (state ? s.putExample(state) : s.deleteExample()))
    .catch(() => undefined);
}

/** Extra stop beside the engine's: a calm "Not for you" so the step-up line (X1-03) can be walked. */
export const CALM_STOP = 'not-for-you-calm';
/** Any stop a screen can jump to. */
export type AnyStop = ExampleStop | typeof CALM_STOP;

/**
 * Riya's trial with no reaction (her Day 9 sting never happens): calm, 56 use-days, no change beyond normal
 * photo difference, blind pick "same". The engine then says Not for you with the step-up (4% -> 6% roll-on).
 * Seeded photo numbers are ILLUSTRATIVE, as in engine/example.ts.
 */
function calmNotForYou(): ExampleState {
  const base = exampleState('day-56-not-for-you');
  const today = addDays(EXAMPLE_DATES.day0, 56);
  const productId = base.plan.trialProduct ?? 'bw-rollon-4';
  const within: PhotoChange = {
    gapDay0: 22,
    gapNow: 21,
    change: 1,
    band: { itaDeg: 4, source: 'day0-pair', samples: 3 },
    beyondBand: false,
    darkerBeyondBand: false,
    comparable: true,
    bucket: 'within-band',
  };
  const trial = trialClock({ productId, startDate: EXAMPLE_DATES.day0, dayLog: [], today });
  const v = verdict({
    trial,
    reactions: [],
    change: within,
    blindPick: base.plan.blindPick ?? null,
    shadeDay0: RIYA_FIT.shade,
    hormonePattern: base.plan.fitResult.hormoneNote,
    killTestPassed: KILL_TEST_PASSED,
    today,
  });
  return { ...base, today, plan: { ...base.plan, reactions: [], dayLog: [], verdict: v } };
}

/** Days she did not log at the end of the example, so the "not logged" line is walked too (FR-M7-01). */
const UNLOGGED_TAIL_DAYS = 5;

/**
 * Riya taps "Used it" on most days: the engine's seed logs only pauses, so every day would read as "not
 * logged". Fill the log up to five days before today and keep the verdict's use-days line honest.
 */
function withLoggedDays(state: ExampleState): ExampleState {
  const { plan, today } = state;
  if (!plan.day0) return state;
  const have = new Set(plan.dayLog.map((e) => e.date));
  const added: DayLogEntry[] = [];
  for (let d = 1; d <= diffDays(today, plan.day0) - UNLOGGED_TAIL_DAYS; d++) {
    const date = addDays(plan.day0, d);
    if (!have.has(date)) added.push({ date, status: 'used', source: 'tap' });
  }
  const dayLog = [...plan.dayLog, ...added];
  let next = { ...plan, dayLog };
  if (plan.verdict && plan.trialProduct) {
    const clock = trialClock({ productId: plan.trialProduct, startDate: plan.day0, dayLog, today });
    const line =
      clock.assumedDays > 0
        ? `${clock.useDaysSoFar} days of use, ${clock.assumedDays} of them not logged and counted as used.`
        : `${clock.useDaysSoFar} days of use, enough to judge fairly.`;
    next = { ...next, verdict: { ...plan.verdict, reasons: plan.verdict.reasons.map((r) => (/^\d+ days of use, /.test(r) ? line : r)) } };
  }
  return { ...state, plan: next };
}

/** Where each jump key lands (SCREENS.md, screen 22). */
export const STOP_ROUTE: Record<ExampleStop, string> = {
  check: '/check/match',
  'day-0': '/start/routine',
  'day-9': '/help',
  'day-23': '/trial',
  halfway: '/trial',
  'day-40': '/trial',
  'day-56-working': '/verdict/pick',
  'day-56-not-for-you': '/verdict',
  'not-yet': '/verdict',
  'cant-call': '/verdict',
  'see-doctor': '/verdict',
  'keep-going': '/keep',
  insights: '/insights',
};

/** True for a valid `?jump=` key. */
export function isStop(key: string | null | undefined): key is AnyStop {
  return !!key && (key === CALM_STOP || Object.prototype.hasOwnProperty.call(STOP_ROUTE, key));
}

/** Route of any stop. */
export function routeOf(stop: AnyStop): string {
  return stop === CALM_STOP ? '/verdict' : STOP_ROUTE[stop];
}

function clearExampleFlags(): void {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('ft-halfway-done-example') || key.startsWith('ft-refill-dismissed-example')) sessionStorage.removeItem(key);
    sessionStorage.removeItem('ft-blind-order');
    sessionStorage.removeItem('ft-shade-now');
  } catch {
    /* ignore */
  }
}

/** Seeds Riya's state at a stop and switches the app into example mode. Her real data is untouched. */
export function enterExample(stop: AnyStop): ExampleState {
  clearExampleFlags();
  current = withLoggedDays(stop === CALM_STOP ? calmNotForYou() : exampleState(stop));
  setVaultMode('example');
  persist();
  emit();
  track('example_jump', '22', { jump: current.stop ?? 'day-56-not-for-you' });
  return current;
}

/** Leaves example mode and drops the example data. Her own plan was never touched. */
export function leaveExample(): void {
  current = null;
  setVaultMode('live');
  persist();
  emit();
}

/** Changes the example plan in memory (a toggle, a reaction). Only ever the example copy. */
export function updateExample(fn: (state: ExampleState) => ExampleState): void {
  if (!current) return;
  current = fn(structuredClone(current));
  persist();
  emit();
}

/** The example state, or null when she is in her real trial. */
export function useExample(): ExampleState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

/** Non-hook read for event handlers. */
export function getExample(): ExampleState | null {
  return current;
}
